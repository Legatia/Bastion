// Quota Service - Enforces tier-based limits and feature gating

import { SubscriptionTier } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Tier feature types
export type TierFeature =
    | 'CDP_WALLET' | 'ERC8004_DAILY' | 'ERC8004_REALTIME'
    | 'MOLTMIND_HEALTH' | 'MOLTMIND_FULL' | 'X402' | 'OPENCLAW';

// Unified tier configuration
export const TIER_CONFIG: Record<SubscriptionTier, {
    maxAgents: number;
    maxDailyChecks: number;
    features: TierFeature[];
}> = {
    FREE:       { maxAgents: 2,        maxDailyChecks: 1000,     features: [] },
    STARTER:    { maxAgents: 10,       maxDailyChecks: 50000,    features: ['CDP_WALLET', 'ERC8004_DAILY', 'MOLTMIND_HEALTH', 'X402'] },
    PRO:        { maxAgents: 25,       maxDailyChecks: Infinity, features: ['CDP_WALLET', 'ERC8004_DAILY', 'ERC8004_REALTIME', 'MOLTMIND_HEALTH', 'MOLTMIND_FULL', 'X402'] },
    ENTERPRISE: { maxAgents: Infinity, maxDailyChecks: Infinity, features: ['CDP_WALLET', 'ERC8004_DAILY', 'ERC8004_REALTIME', 'MOLTMIND_HEALTH', 'MOLTMIND_FULL', 'X402'] },
};

// In-memory TTL cache for feature access checks
const FEATURE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const featureCache = new Map<string, { allowed: boolean; message?: string; cachedAt: number }>();

export class QuotaService {
    /**
     * Check if user has access to a tier feature
     */
    static async checkFeatureAccess(
        userId: string,
        feature: TierFeature
    ): Promise<{ allowed: boolean; message?: string }> {
        // Check cache
        const cacheKey = `${userId}:feature:${feature}`;
        const cached = featureCache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < FEATURE_CACHE_TTL_MS) {
            return { allowed: cached.allowed, message: cached.message };
        }

        // Agent Runtime is special-cased via user flag (stored as openclawPurchased for backward compat)
        if (feature === 'OPENCLAW') {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { openclawPurchased: true },
            });
            const result = user?.openclawPurchased
                ? { allowed: true }
                : { allowed: false, message: 'Agent Runtime license not purchased. Available as $99 one-time add-on.' };
            featureCache.set(cacheKey, { ...result, cachedAt: Date.now() });
            return result;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        });

        if (!user) {
            return { allowed: false, message: 'User not found' };
        }

        const config = TIER_CONFIG[user.tier];
        const allowed = config.features.includes(feature);

        // Determine the minimum tier that includes this feature
        const tierOrder: SubscriptionTier[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
        const minTier = tierOrder.find(t => TIER_CONFIG[t].features.includes(feature)) || 'STARTER';

        const result = allowed
            ? { allowed: true }
            : { allowed: false, message: `${feature} requires ${minTier} tier or higher. Upgrade your plan to access this feature.` };

        featureCache.set(cacheKey, { ...result, cachedAt: Date.now() });
        return result;
    }

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

        const config = TIER_CONFIG[user.tier];
        const agentCount = await prisma.agent.count({
            where: { userId },
        });

        const allowed = agentCount < config.maxAgents;

        return {
            allowed,
            current: agentCount,
            max: config.maxAgents,
            message: allowed
                ? undefined
                : `Agent limit reached (${agentCount}/${config.maxAgents}). Upgrade your plan to add more agents.`,
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

        const config = TIER_CONFIG[user.tier];

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
        const allowed = checksToday < config.maxDailyChecks;

        return {
            allowed,
            current: checksToday,
            max: config.maxDailyChecks,
            message: allowed
                ? undefined
                : `Daily check limit reached (${checksToday}/${config.maxDailyChecks}). Upgrade your plan for more checks.`,
        };
    }

    /**
     * Get user's current quota usage summary
     */
    static async getUsageSummary(userId: string): Promise<{
        tier: string;
        agents: { current: number; max: number };
        dailyChecks: { current: number; max: number };
        features: TierFeature[];
    }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const config = TIER_CONFIG[user.tier];

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
                max: config.maxAgents === Infinity ? -1 : config.maxAgents,
            },
            dailyChecks: {
                current: usage?.checksCount || 0,
                max: config.maxDailyChecks === Infinity ? -1 : config.maxDailyChecks,
            },
            features: config.features,
        };
    }

    /**
     * Invalidate feature cache for a user (call after tier changes)
     */
    static invalidateFeatureCache(userId: string): void {
        for (const key of featureCache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                featureCache.delete(key);
            }
        }
    }

    /**
     * Alias for backward compat
     */
    static invalidateModuleCache(userId: string): void {
        this.invalidateFeatureCache(userId);
    }
}
