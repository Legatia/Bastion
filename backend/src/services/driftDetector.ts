/**
 * MoltMind Drift Detector
 * Compares recent behavior against baseline to detect anomalies
 */

import { PrismaClient } from '@prisma/client';
import { baselineEngine, BaselineMetrics } from './baselineEngine';

const prisma = new PrismaClient();

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

        // Get recent events
        const windowStart = new Date();
        windowStart.setHours(windowStart.getHours() - windowHours);

        const recentEvents = await prisma.behavioralEvent.findMany({
            where: {
                agentId,
                timestamp: { gte: windowStart },
            },
        });

        if (recentEvents.length < 10) {
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
        const currentRate = recentEvents.length / windowHours;
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

        // Check sentiment drift
        const recentSentiments = recentEvents.map((e) => e.sentimentScore).filter(Boolean) as number[];
        if (recentSentiments.length > 5 && baseline.sentimentStddev > 0) {
            const currentSentiment = this.mean(recentSentiments);
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

        // Check for new dominant interaction partner
        const partnerDrift = this.checkInteractionPartnerDrift(recentEvents, baseline);
        if (partnerDrift) {
            components.push(partnerDrift.component);
            if (partnerDrift.alert) alerts.push(partnerDrift.alert);
        }

        // Check endpoint distribution shift
        const endpointDrift = this.checkEndpointDrift(recentEvents, baseline);
        if (endpointDrift) {
            components.push(endpointDrift.component);
            if (endpointDrift.alert) alerts.push(endpointDrift.alert);
        }

        // Calculate overall health score
        const avgZScore = this.mean(components.map((c) => Math.abs(c.zScore)));
        const overallScore = Math.max(0, Math.min(100, 100 - avgZScore * 20));

        // Save alerts to database
        for (const alert of alerts) {
            const component = components.find((c) => c.metric === alert.type.split('_')[0]) || components[0];
            await this.saveAlert(agentId, alert, component);
        }

        // Update health score
        await this.updateHealthScore(agentId, overallScore, components, alerts);

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
        recentEvents: any[],
        baseline: BaselineMetrics
    ): { component: DriftResult['components'][0]; alert?: DriftResult['alerts'][0] } | null {
        const recentPartners: Record<string, number> = {};
        recentEvents.forEach((e) => {
            if (e.targetAgentId) {
                recentPartners[e.targetAgentId] = (recentPartners[e.targetAgentId] || 0) + 1;
            }
        });

        const partnerInteractions = Object.entries(recentPartners);
        if (partnerInteractions.length === 0) return null;

        // Check if a new agent is dominating interactions
        const topPartner = partnerInteractions.sort((a, b) => b[1] - a[1])[0];
        const [partnerId, count] = topPartner;
        const totalInteractions = partnerInteractions.reduce((sum, [_, c]) => sum + c, 0);
        const dominanceRatio = count / totalInteractions;

        // Was this partner in baseline top interactions?
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
        recentEvents: any[],
        baseline: BaselineMetrics
    ): { component: DriftResult['components'][0]; alert?: DriftResult['alerts'][0] } | null {
        const recentEndpoints: Record<string, number> = {};
        recentEvents.forEach((e) => {
            recentEndpoints[e.endpoint] = (recentEndpoints[e.endpoint] || 0) + 1;
        });

        const total = recentEvents.length;
        const recentDistribution: Record<string, number> = {};
        Object.entries(recentEndpoints).forEach(([endpoint, count]) => {
            recentDistribution[endpoint] = count / total;
        });

        // Calculate cosine similarity between distributions
        const similarity = this.cosineSimilarity(baseline.topEndpoints, recentDistribution);
        const driftScore = 1 - similarity; // 0 = identical, 1 = completely different

        const component: DriftResult['components'][0] = {
            metric: 'endpoint_distribution',
            baselineValue: 1,
            currentValue: similarity,
            zScore: driftScore * 3, // Scale to z-score-like range
            severity: this.getSeverity(driftScore * 3),
        };

        if (driftScore > 0.5) {
            const newEndpoints = Object.keys(recentEndpoints)
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

    private async saveAlert(agentId: string, alert: any, component: any): Promise<void> {
        await prisma.cognitiveAlert.create({
            data: {
                agentId,
                alertType: alert.type,
                severity: alert.severity,
                metric: component.metric,
                baselineValue: component.baselineValue,
                currentValue: component.currentValue,
                driftScore: Math.abs(component.zScore) / 3, // Normalize to 0-1
                details: { message: alert.message },
            },
        });
    }

    private async updateHealthScore(
        agentId: string,
        overallScore: number,
        components: DriftResult['components'],
        alerts: DriftResult['alerts']
    ): Promise<void> {
        const identityMetrics = components.filter((c) => ['sentiment', 'interaction_partner'].includes(c.metric));
        const behavioralMetrics = components.filter((c) => ['request_rate', 'endpoint_distribution'].includes(c.metric));

        const identityScore = 100 - this.mean(identityMetrics.map((c) => Math.abs(c.zScore))) * 20;
        const behavioralScore = 100 - this.mean(behavioralMetrics.map((c) => Math.abs(c.zScore))) * 20;
        const interactionScore =
            100 - (components.find((c) => c.metric === 'interaction_partner')?.zScore || 0) * 20;

        await prisma.agentHealthScore.create({
            data: {
                agentId,
                overallScore: Math.round(overallScore),
                identityCoherence: Math.max(0, Math.min(100, Math.round(identityScore))),
                behavioralStability: Math.max(0, Math.min(100, Math.round(behavioralScore))),
                interactionHealth: Math.max(0, Math.min(100, Math.round(interactionScore))),
                activeFlags: alerts.map((a) => a.type),
            },
        });
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
