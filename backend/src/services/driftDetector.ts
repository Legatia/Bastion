/**
 * MoltMind Drift Detector
 * Compares recent behavior against baseline to detect anomalies
 */

import { prisma } from '../lib/prisma';
import { baselineEngine, BaselineMetrics } from './baselineEngine';

export interface DriftResult {
    hasDrift: boolean;
    overallScore: number; // 0-100 (100 = healthy)
    components: {
        metric: string;
        baselineValue: number;
        currentValue: number;
        zScore: number;
        severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    }[];
    alerts: {
        type: string;
        severity: string;
        message: string;
    }[];
}

export class DriftDetector {
    // Z-score thresholds
    private readonly THRESHOLDS = {
        low: 1.5,
        medium: 2.0,
        high: 2.5,
        critical: 3.0,
    };

    // Dedup window: don't create duplicate alerts within this period
    private readonly ALERT_DEDUP_HOURS = 24;

    /**
     * Analyze recent behavior against baseline
     * Default: last 24 hours vs baseline
     */
    async detectDrift(agentId: string, windowHours: number = 24): Promise<DriftResult> {
        const baseline = await baselineEngine.getBaseline(agentId);

        if (!baseline) {
            return {
                hasDrift: false,
                overallScore: 50, // Unknown, not enough data
                components: [],
                alerts: [{ type: 'no_baseline', severity: 'low', message: 'Insufficient data for baseline' }],
            };
        }

        // Time window
        const windowStart = new Date();
        windowStart.setHours(windowStart.getHours() - windowHours);

        // Run all aggregation queries in parallel (no findMany — DB does the work)
        const [
            eventCount,
            aggregates,
            endpointCounts,
            partnerCounts,
        ] = await Promise.all([
            prisma.behavioralEvent.count({
                where: { agentId, timestamp: { gte: windowStart } },
            }),
            prisma.behavioralEvent.aggregate({
                where: { agentId, timestamp: { gte: windowStart } },
                _avg: { sentimentScore: true, responseTimeMs: true },
                _count: { sentimentScore: true, responseTimeMs: true },
            }),
            prisma.behavioralEvent.groupBy({
                by: ['endpoint'],
                where: { agentId, timestamp: { gte: windowStart } },
                _count: true,
                orderBy: { _count: { endpoint: 'desc' } },
                take: 20,
            }),
            prisma.behavioralEvent.groupBy({
                by: ['targetAgentId'],
                where: {
                    agentId,
                    timestamp: { gte: windowStart },
                    targetAgentId: { not: null },
                },
                _count: true,
                orderBy: { _count: { targetAgentId: 'desc' } },
                take: 10,
            }),
        ]);

        if (eventCount < 10) {
            return {
                hasDrift: false,
                overallScore: 50,
                components: [],
                alerts: [{ type: 'low_activity', severity: 'low', message: 'Low recent activity' }],
            };
        }

        const components: DriftResult['components'] = [];
        const alerts: DriftResult['alerts'] = [];

        // Check request rate
        const currentRate = eventCount / windowHours;
        const rateZScore = this.zScore(currentRate, baseline.requestRate.mean, baseline.requestRate.stddev);
        components.push({
            metric: 'request_rate',
            baselineValue: baseline.requestRate.mean,
            currentValue: currentRate,
            zScore: rateZScore,
            severity: this.getSeverity(rateZScore),
        });

        if (Math.abs(rateZScore) > this.THRESHOLDS.high) {
            alerts.push({
                type: 'activity_anomaly',
                severity: 'high',
                message: `Request rate ${rateZScore > 0 ? 'spike' : 'drop'}: ${currentRate.toFixed(1)}/hr vs baseline ${baseline.requestRate.mean.toFixed(1)}/hr`,
            });
        }

        // Check sentiment drift (using DB-computed average)
        if (aggregates._count.sentimentScore > 5 && baseline.sentimentStddev > 0) {
            const currentSentiment = aggregates._avg.sentimentScore || 0;
            const sentimentZScore = this.zScore(currentSentiment, baseline.sentimentMean, baseline.sentimentStddev);
            components.push({
                metric: 'sentiment',
                baselineValue: baseline.sentimentMean,
                currentValue: currentSentiment,
                zScore: sentimentZScore,
                severity: this.getSeverity(sentimentZScore),
            });

            if (Math.abs(sentimentZScore) > this.THRESHOLDS.medium) {
                alerts.push({
                    type: 'identity_drift',
                    severity: 'medium',
                    message: `Sentiment shift detected: ${currentSentiment.toFixed(2)} vs baseline ${baseline.sentimentMean.toFixed(2)}`,
                });
            }
        }

        // Check response time drift (using DB-computed average)
        if (baseline.responseTime && baseline.responseTime.stddev > 0 && aggregates._count.responseTimeMs > 5) {
            const currentResponseTime = aggregates._avg.responseTimeMs || 0;
            const rtZScore = this.zScore(
                currentResponseTime,
                baseline.responseTime.mean,
                baseline.responseTime.stddev
            );
            components.push({
                metric: 'response_time',
                baselineValue: baseline.responseTime.mean,
                currentValue: currentResponseTime,
                zScore: rtZScore,
                severity: this.getSeverity(rtZScore),
            });

            if (Math.abs(rtZScore) > this.THRESHOLDS.high) {
                alerts.push({
                    type: 'response_time_anomaly',
                    severity: rtZScore > 0 ? 'high' : 'medium',
                    message: `Response time ${rtZScore > 0 ? 'spike' : 'drop'}: ${currentResponseTime.toFixed(0)}ms vs baseline ${baseline.responseTime.mean.toFixed(0)}ms`,
                });
            }
        }

        // Check for new dominant interaction partner (from DB groupBy)
        const partnerDrift = this.checkInteractionPartnerDrift(partnerCounts, baseline);
        if (partnerDrift) {
            components.push(partnerDrift.component);
            if (partnerDrift.alert) alerts.push(partnerDrift.alert);
        }

        // Check endpoint distribution shift (from DB groupBy)
        const endpointDrift = this.checkEndpointDrift(endpointCounts, eventCount, baseline);
        if (endpointDrift) {
            components.push(endpointDrift.component);
            if (endpointDrift.alert) alerts.push(endpointDrift.alert);
        }

        // Calculate overall health score
        const absZScores = components.map((c) => Math.abs(c.zScore));
        const avgZScore = absZScores.length > 0 ? this.mean(absZScores) : 0;
        const overallScore = Math.max(0, Math.min(100, 100 - avgZScore * 20));

        // Save alerts (with dedup)
        for (const alert of alerts) {
            const component = components.find((c) => c.metric === alert.type.split('_')[0]) || components[0];
            if (component) {
                await this.saveAlertIfNew(agentId, alert, component);
            }
        }

        // Update health score (upsert)
        await this.upsertHealthScore(agentId, overallScore, components, alerts);

        return {
            hasDrift: alerts.some((a) => a.severity === 'high' || a.severity === 'critical'),
            overallScore: Math.round(overallScore),
            components,
            alerts,
        };
    }

    /**
     * Get current health score for an agent
     */
    async getHealthScore(agentId: string): Promise<{
        score: number;
        identityCoherence: number;
        behavioralStability: number;
        interactionHealth: number;
        flags: string[];
    } | null> {
        const health = await prisma.agentHealthScore.findFirst({
            where: { agentId },
            orderBy: { computedAt: 'desc' },
        });

        if (!health) return null;

        return {
            score: health.overallScore,
            identityCoherence: health.identityCoherence,
            behavioralStability: health.behavioralStability,
            interactionHealth: health.interactionHealth,
            flags: health.activeFlags,
        };
    }

    /**
     * Get recent alerts for an agent
     */
    async getAlerts(
        agentId: string,
        limit: number = 20
    ): Promise<
        {
            id: string;
            type: string;
            severity: string;
            metric: string;
            message: string;
            driftScore: number;
            acknowledged: boolean;
            createdAt: Date;
        }[]
    > {
        const alerts = await prisma.cognitiveAlert.findMany({
            where: { agentId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return alerts.map((a) => ({
            id: a.id,
            type: a.alertType,
            severity: a.severity,
            metric: a.metric,
            message: (a.details as any)?.message || '',
            driftScore: a.driftScore,
            acknowledged: a.acknowledged,
            createdAt: a.createdAt,
        }));
    }

    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId: string): Promise<void> {
        await prisma.cognitiveAlert.update({
            where: { id: alertId },
            data: { acknowledged: true, resolvedAt: new Date() },
        });
    }

    // ========================
    // Private Methods
    // ========================

    private checkInteractionPartnerDrift(
        partnerCounts: { targetAgentId: string | null; _count: number }[],
        baseline: BaselineMetrics
    ): { component: DriftResult['components'][0]; alert?: DriftResult['alerts'][0] } | null {
        const validPartners = partnerCounts.filter((p) => p.targetAgentId);
        if (validPartners.length === 0) return null;

        // Already sorted desc by _count from the DB groupBy
        const topPartner = validPartners[0];
        const partnerId = topPartner.targetAgentId!;
        const count = topPartner._count;
        const totalInteractions = validPartners.reduce((sum, p) => sum + p._count, 0);
        const dominanceRatio = count / totalInteractions;

        const baselinePartnerCount = baseline.topInteractionPartners[partnerId] || 0;
        const isNewDominant = dominanceRatio > 0.4 && baselinePartnerCount < 5;

        const component: DriftResult['components'][0] = {
            metric: 'interaction_partner',
            baselineValue: baselinePartnerCount,
            currentValue: count,
            zScore: isNewDominant ? 3.0 : 0.5,
            severity: isNewDominant ? 'high' : 'none',
        };

        if (isNewDominant) {
            return {
                component,
                alert: {
                    type: 'manipulation_detected',
                    severity: 'high',
                    message: `New agent ${partnerId.slice(0, 8)}... dominates ${(dominanceRatio * 100).toFixed(0)}% of recent interactions`,
                },
            };
        }

        return { component };
    }

    private checkEndpointDrift(
        endpointCounts: { endpoint: string; _count: number }[],
        totalEvents: number,
        baseline: BaselineMetrics
    ): { component: DriftResult['components'][0]; alert?: DriftResult['alerts'][0] } | null {
        if (endpointCounts.length === 0) return null;

        const recentDistribution: Record<string, number> = {};
        for (const ep of endpointCounts) {
            recentDistribution[ep.endpoint] = ep._count / totalEvents;
        }

        const similarity = this.cosineSimilarity(baseline.topEndpoints, recentDistribution);
        const driftScore = 1 - similarity;

        const component: DriftResult['components'][0] = {
            metric: 'endpoint_distribution',
            baselineValue: 1,
            currentValue: similarity,
            zScore: driftScore * 3,
            severity: this.getSeverity(driftScore * 3),
        };

        if (driftScore > 0.5) {
            const newEndpoints = endpointCounts
                .map((ep) => ep.endpoint)
                .filter((e) => !baseline.topEndpoints[e])
                .slice(0, 3);

            return {
                component,
                alert: {
                    type: 'endpoint_anomaly',
                    severity: 'medium',
                    message: `API usage pattern changed. New endpoints: ${newEndpoints.join(', ') || 'none detected'}`,
                },
            };
        }

        return { component };
    }

    /**
     * Save alert only if no unacknowledged alert of the same type exists
     * within the dedup window.
     */
    private async saveAlertIfNew(agentId: string, alert: any, component: any): Promise<void> {
        const dedupSince = new Date();
        dedupSince.setHours(dedupSince.getHours() - this.ALERT_DEDUP_HOURS);

        const existing = await prisma.cognitiveAlert.findFirst({
            where: {
                agentId,
                alertType: alert.type,
                acknowledged: false,
                createdAt: { gte: dedupSince },
            },
        });

        if (existing) {
            // Skip duplicate — already have an active alert for this type
            return;
        }

        await prisma.cognitiveAlert.create({
            data: {
                agentId,
                alertType: alert.type,
                severity: alert.severity,
                metric: component.metric,
                baselineValue: component.baselineValue,
                currentValue: component.currentValue,
                driftScore: Math.abs(component.zScore) / 3,
                details: { message: alert.message },
            },
        });
    }

    /**
     * Upsert health score — one row per agent, updated in place.
     */
    private async upsertHealthScore(
        agentId: string,
        overallScore: number,
        components: DriftResult['components'],
        alerts: DriftResult['alerts']
    ): Promise<void> {
        const identityMetrics = components.filter((c) => ['sentiment', 'interaction_partner'].includes(c.metric));
        const behavioralMetrics = components.filter((c) => ['request_rate', 'endpoint_distribution', 'response_time'].includes(c.metric));

        const identityScore = this.clampScore(
            100 - this.mean(identityMetrics.map((c) => Math.abs(c.zScore))) * 20
        );
        const behavioralScore = this.clampScore(
            100 - this.mean(behavioralMetrics.map((c) => Math.abs(c.zScore))) * 20
        );
        const interactionScore = this.clampScore(
            100 - Math.abs(components.find((c) => c.metric === 'interaction_partner')?.zScore || 0) * 20
        );

        const data = {
            overallScore: Math.round(this.clampScore(overallScore)),
            identityCoherence: Math.round(identityScore),
            behavioralStability: Math.round(behavioralScore),
            interactionHealth: Math.round(interactionScore),
            activeFlags: alerts.map((a) => a.type),
            computedAt: new Date(),
        };

        // Try to find existing health score for this agent
        const existing = await prisma.agentHealthScore.findFirst({
            where: { agentId },
            orderBy: { computedAt: 'desc' },
        });

        if (existing) {
            await prisma.agentHealthScore.update({
                where: { id: existing.id },
                data,
            });
        } else {
            await prisma.agentHealthScore.create({
                data: { agentId, ...data },
            });
        }
    }

    private clampScore(value: number): number {
        return Math.max(0, Math.min(100, value));
    }

    private zScore(value: number, mean: number, stddev: number): number {
        if (stddev === 0) return 0;
        return (value - mean) / stddev;
    }

    private getSeverity(zScore: number): 'none' | 'low' | 'medium' | 'high' | 'critical' {
        const abs = Math.abs(zScore);
        if (abs >= this.THRESHOLDS.critical) return 'critical';
        if (abs >= this.THRESHOLDS.high) return 'high';
        if (abs >= this.THRESHOLDS.medium) return 'medium';
        if (abs >= this.THRESHOLDS.low) return 'low';
        return 'none';
    }

    private mean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    private cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
        const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        allKeys.forEach((key) => {
            const valA = a[key] || 0;
            const valB = b[key] || 0;
            dotProduct += valA * valB;
            normA += valA * valA;
            normB += valB * valB;
        });

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

export const driftDetector = new DriftDetector();
