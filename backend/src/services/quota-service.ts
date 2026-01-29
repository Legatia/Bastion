// Quota Service - Enforces subscription tier limits

import { PrismaClient, SubscriptionTier } from '@prisma/client';

const prisma = new PrismaClient();

// Tier limits configuration
const TIER_LIMITS: Record<SubscriptionTier, { maxAgents: number; maxDailyChecks: number }> = {
    STARTER: { maxAgents: 1, maxDailyChecks: 1000 },
    GROWTH: { maxAgents: 5, maxDailyChecks: 10000 },
    PRO: { maxAgents: Infinity, maxDailyChecks: 100000 },
    ENTERPRISE: { maxAgents: Infinity, maxDailyChecks: Infinity },
};

export class QuotaService {
    /**
     * Check if user can create a new agent
     */
    static async checkAgentLimit(userId: string): Promise<{
        allowed: boolean;
        current: number;
        max: number;
        message?: string;
    }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        });

        if (!user) {
            return { allowed: false, current: 0, max: 0, message: 'User not found' };
        }

        const limits = TIER_LIMITS[user.tier];
        const agentCount = await prisma.agent.count({
            where: { userId },
        });

        const allowed = agentCount < limits.maxAgents;

        return {
            allowed,
            current: agentCount,
            max: limits.maxAgents,
            message: allowed
                ? undefined
                : `Agent limit reached (${agentCount}/${limits.maxAgents}). Upgrade your plan to add more agents.`,
        };
    }

    /**
     * Check if user has remaining daily checks
     */
    static async checkDailyLimit(userId: string): Promise<{
        allowed: boolean;
        current: number;
        max: number;
        message?: string;
    }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        });

        if (!user) {
            return { allowed: false, current: 0, max: 0, message: 'User not found' };
        }

        const limits = TIER_LIMITS[user.tier];

        // Get today's usage
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const usage = await prisma.usageMetric.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        const checksToday = usage?.checksCount || 0;
        const allowed = checksToday < limits.maxDailyChecks;

        return {
            allowed,
            current: checksToday,
            max: limits.maxDailyChecks,
            message: allowed
                ? undefined
                : `Daily check limit reached (${checksToday}/${limits.maxDailyChecks}). Upgrade your plan for more checks.`,
        };
    }

    /**
     * Get user's current quota usage summary
     */
    static async getUsageSummary(userId: string): Promise<{
        tier: string;
        agents: { current: number; max: number };
        dailyChecks: { current: number; max: number };
    }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const limits = TIER_LIMITS[user.tier];

        const agentCount = await prisma.agent.count({
            where: { userId },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const usage = await prisma.usageMetric.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        return {
            tier: user.tier,
            agents: {
                current: agentCount,
                max: limits.maxAgents === Infinity ? -1 : limits.maxAgents, // -1 indicates unlimited
            },
            dailyChecks: {
                current: usage?.checksCount || 0,
                max: limits.maxDailyChecks === Infinity ? -1 : limits.maxDailyChecks,
            },
        };
    }
}
