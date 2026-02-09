/**
 * MoltMind Baseline Engine
 * Calculates "normal" behavior patterns for each agent
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface BaselineMetrics {
    requestRate: { mean: number; stddev: number };
    responseLength: { mean: number; stddev: number };
    sentimentMean: number;
    sentimentStddev: number;
    topEndpoints: Record<string, number>; // endpoint -> frequency ratio
    activeHours: number[];
    topInteractionPartners: Record<string, number>; // agentId -> count
}

export class BaselineEngine {
    /**
     * Calculate baseline for an agent over a time window
     * Default: 7 days of data
     */
    async calculateBaseline(agentId: string, windowDays: number = 7): Promise<BaselineMetrics | null> {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - windowDays);

        const events = await prisma.behavioralEvent.findMany({
            where: {
                agentId,
                timestamp: { gte: windowStart },
            },
            orderBy: { timestamp: 'asc' },
        });

        if (events.length < 50) {
            console.log(`[MoltMind] Insufficient data for baseline (${events.length} events, need 50+)`);
            return null;
        }

        // Calculate metrics
        const metrics: BaselineMetrics = {
            requestRate: this.calculateRateStats(events),
            responseLength: this.calculateLengthStats(events),
            sentimentMean: this.mean(events.map((e) => e.sentimentScore).filter(Boolean) as number[]),
            sentimentStddev: this.stddev(events.map((e) => e.sentimentScore).filter(Boolean) as number[]),
            topEndpoints: this.calculateEndpointDistribution(events),
            activeHours: this.calculateActiveHours(events),
            topInteractionPartners: this.calculateInteractionPartners(events),
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
                eventCount: events.length,
                metrics: metrics as any,
                isActive: true,
            },
        });

        console.log(`[MoltMind] Baseline calculated for agent ${agentId}: ${events.length} events`);
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
    // Calculation Helpers
    // ========================

    private calculateRateStats(events: any[]): { mean: number; stddev: number } {
        // Group events by hour, calculate requests per hour
        const hourlyBuckets: Record<string, number> = {};

        events.forEach((e) => {
            const hourKey = new Date(e.timestamp).toISOString().slice(0, 13);
            hourlyBuckets[hourKey] = (hourlyBuckets[hourKey] || 0) + 1;
        });

        const rates = Object.values(hourlyBuckets);
        return { mean: this.mean(rates), stddev: this.stddev(rates) };
    }

    private calculateLengthStats(events: any[]): { mean: number; stddev: number } {
        const lengths = events.map((e) => e.contentLength).filter(Boolean) as number[];
        if (lengths.length === 0) return { mean: 0, stddev: 0 };
        return { mean: this.mean(lengths), stddev: this.stddev(lengths) };
    }

    private calculateEndpointDistribution(events: any[]): Record<string, number> {
        const counts: Record<string, number> = {};
        events.forEach((e) => {
            counts[e.endpoint] = (counts[e.endpoint] || 0) + 1;
        });

        const total = events.length;
        const distribution: Record<string, number> = {};
        Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) // Top 10
            .forEach(([endpoint, count]) => {
                distribution[endpoint] = count / total;
            });

        return distribution;
    }

    private calculateActiveHours(events: any[]): number[] {
        const hourCounts: Record<number, number> = {};
        events.forEach((e) => {
            const hour = new Date(e.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        // Return hours that have >5% of activity
        const threshold = events.length * 0.05;
        return Object.entries(hourCounts)
            .filter(([_, count]) => count > threshold)
            .map(([hour]) => parseInt(hour))
            .sort((a, b) => a - b);
    }

    private calculateInteractionPartners(events: any[]): Record<string, number> {
        const counts: Record<string, number> = {};
        events.forEach((e) => {
            if (e.targetAgentId) {
                counts[e.targetAgentId] = (counts[e.targetAgentId] || 0) + 1;
            }
        });

        // Return top 10
        return Object.fromEntries(
            Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
        );
    }

    private mean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    private stddev(values: number[]): number {
        if (values.length < 2) return 0;
        const m = this.mean(values);
        const squaredDiffs = values.map((v) => Math.pow(v - m, 2));
        return Math.sqrt(this.mean(squaredDiffs));
    }
}

export const baselineEngine = new BaselineEngine();
