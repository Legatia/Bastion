/**
 * MoltMind Baseline Engine
 * Calculates "normal" behavior patterns for each agent
 * Uses DB-level aggregation to avoid loading all events into memory.
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export interface BaselineMetrics {
    requestRate: { mean: number; stddev: number };
    responseLength: { mean: number; stddev: number };
    responseTime: { mean: number; stddev: number };
    sentimentMean: number;
    sentimentStddev: number;
    topEndpoints: Record<string, number>; // endpoint -> frequency ratio
    activeHours: number[];
    topInteractionPartners: Record<string, number>; // agentId -> count
}

export class BaselineEngine {
    /**
     * Calculate baseline for an agent over a time window.
     * Uses DB aggregation queries instead of loading all events into memory.
     */
    async calculateBaseline(agentId: string, windowDays: number = 7): Promise<BaselineMetrics | null> {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - windowDays);

        // Check count first
        const totalCount = await prisma.behavioralEvent.count({
            where: { agentId, timestamp: { gte: windowStart } },
        });

        if (totalCount < 50) {
            console.log(`[MoltMind] Insufficient data for baseline (${totalCount} events, need 50+)`);
            return null;
        }

        // Run aggregation queries in parallel
        const [
            aggregates,
            endpointCounts,
            hourCounts,
            partnerCounts,
            hourlyCounts,
        ] = await Promise.all([
            // Aggregate sentiment, content length, response time
            prisma.behavioralEvent.aggregate({
                where: { agentId, timestamp: { gte: windowStart } },
                _avg: { sentimentScore: true, contentLength: true, responseTimeMs: true },
                _count: true,
            }),
            // Top endpoints with counts
            prisma.behavioralEvent.groupBy({
                by: ['endpoint'],
                where: { agentId, timestamp: { gte: windowStart } },
                _count: true,
                orderBy: { _count: { endpoint: 'desc' } },
                take: 10,
            }),
            // Hour-of-day distribution
            this.getHourDistribution(agentId, windowStart),
            // Top interaction partners
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
            // Hourly request counts for rate stats
            this.getHourlyRequestCounts(agentId, windowStart),
        ]);

        // Compute stddev for sentiment and lengths via a second pass
        // (Prisma doesn't support stddev natively, use raw query)
        const stddevs = await this.computeStddevs(agentId, windowStart);

        // Build endpoint distribution
        const topEndpoints: Record<string, number> = {};
        for (const ep of endpointCounts) {
            topEndpoints[ep.endpoint] = ep._count / totalCount;
        }

        // Build interaction partners
        const topInteractionPartners: Record<string, number> = {};
        for (const p of partnerCounts) {
            if (p.targetAgentId) {
                topInteractionPartners[p.targetAgentId] = p._count;
            }
        }

        // Active hours (hours with >5% of total traffic)
        const threshold = totalCount * 0.05;
        const activeHours = hourCounts
            .filter((h) => h.count > threshold)
            .map((h) => h.hour)
            .sort((a, b) => a - b);

        // Rate stats from hourly buckets
        const rates = hourlyCounts.map((h) => h.count);
        const rateMean = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
        const rateStddev = this.computeArrayStddev(rates);

        const metrics: BaselineMetrics = {
            requestRate: { mean: rateMean, stddev: rateStddev },
            responseLength: {
                mean: aggregates._avg.contentLength || 0,
                stddev: stddevs.contentLengthStddev,
            },
            responseTime: {
                mean: aggregates._avg.responseTimeMs || 0,
                stddev: stddevs.responseTimeMsStddev,
            },
            sentimentMean: aggregates._avg.sentimentScore || 0,
            sentimentStddev: stddevs.sentimentStddev,
            topEndpoints,
            activeHours,
            topInteractionPartners,
        };

        // Deactivate old baselines
        await prisma.agentBaseline.updateMany({
            where: { agentId, isActive: true },
            data: { isActive: false },
        });

        // Store new baseline
        await prisma.agentBaseline.create({
            data: {
                agentId,
                windowStart,
                windowEnd: new Date(),
                eventCount: totalCount,
                metrics: metrics as any,
                isActive: true,
            },
        });

        console.log(`[MoltMind] Baseline calculated for agent ${agentId}: ${totalCount} events`);
        return metrics;
    }

    /**
     * Get current active baseline for an agent
     */
    async getBaseline(agentId: string): Promise<BaselineMetrics | null> {
        const baseline = await prisma.agentBaseline.findFirst({
            where: { agentId, isActive: true },
        });
        return (baseline?.metrics as unknown as BaselineMetrics) || null;
    }

    /**
     * Check if an agent has enough data for a baseline
     */
    async hasEnoughData(agentId: string, minEvents: number = 50): Promise<boolean> {
        const count = await prisma.behavioralEvent.count({
            where: { agentId },
        });
        return count >= minEvents;
    }

    // ========================
    // Private Helpers
    // ========================

    /**
     * Get event counts grouped by hour-of-day using raw SQL.
     */
    private async getHourDistribution(
        agentId: string,
        windowStart: Date
    ): Promise<{ hour: number; count: number }[]> {
        const rows: { hour: number; count: bigint }[] = await prisma.$queryRaw`
            SELECT EXTRACT(HOUR FROM "timestamp")::int AS hour, COUNT(*)::bigint AS count
            FROM "behavioral_events"
            WHERE "agentId" = ${agentId} AND "timestamp" >= ${windowStart}
            GROUP BY hour
            ORDER BY hour
        `;
        return rows.map((r) => ({ hour: r.hour, count: Number(r.count) }));
    }

    /**
     * Get hourly request counts (bucketed by calendar hour) for rate stats.
     */
    private async getHourlyRequestCounts(
        agentId: string,
        windowStart: Date
    ): Promise<{ bucket: string; count: number }[]> {
        const rows: { bucket: string; count: bigint }[] = await prisma.$queryRaw`
            SELECT date_trunc('hour', "timestamp")::text AS bucket, COUNT(*)::bigint AS count
            FROM "behavioral_events"
            WHERE "agentId" = ${agentId} AND "timestamp" >= ${windowStart}
            GROUP BY bucket
            ORDER BY bucket
        `;
        return rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }));
    }

    /**
     * Compute stddev for sentiment, content length, and response time via raw SQL.
     */
    private async computeStddevs(
        agentId: string,
        windowStart: Date
    ): Promise<{
        sentimentStddev: number;
        contentLengthStddev: number;
        responseTimeMsStddev: number;
    }> {
        const rows: {
            sentiment_stddev: number | null;
            content_length_stddev: number | null;
            response_time_stddev: number | null;
        }[] = await prisma.$queryRaw`
            SELECT
                COALESCE(STDDEV_SAMP("sentimentScore"), 0)::float AS sentiment_stddev,
                COALESCE(STDDEV_SAMP("contentLength"), 0)::float AS content_length_stddev,
                COALESCE(STDDEV_SAMP("responseTimeMs"), 0)::float AS response_time_stddev
            FROM "behavioral_events"
            WHERE "agentId" = ${agentId} AND "timestamp" >= ${windowStart}
        `;

        const row = rows[0];
        return {
            sentimentStddev: row?.sentiment_stddev || 0,
            contentLengthStddev: row?.content_length_stddev || 0,
            responseTimeMsStddev: row?.response_time_stddev || 0,
        };
    }

    private computeArrayStddev(values: number[]): number {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
    }
}

export const baselineEngine = new BaselineEngine();
