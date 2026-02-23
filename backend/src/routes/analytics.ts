// Analytics Endpoints

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateApiKey } from '../middleware/auth';
import { logger } from '../middleware/logger';
import { isAdminEmail } from '../utils/admin';

const router = Router();

/**
 * GET /v1/analytics/summary
 * Get usage summary for authenticated user
 * Query params:
 *   - from: start date (ISO string, default: 30 days ago)
 *   - to: end date (ISO string, default: today)
 */
router.get('/analytics/summary', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse date range
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    // Get usage metrics
    const metrics = await prisma.usageMetric.findMany({
      where: {
        userId: req.user.id,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate totals
    const totals = metrics.reduce(
      (acc, m) => ({
        checksCount: acc.checksCount + m.checksCount,
        blockedCount: acc.blockedCount + m.blockedCount,
        allowedCount: acc.allowedCount + m.allowedCount,
        errorCount: acc.errorCount + m.errorCount,
      }),
      { checksCount: 0, blockedCount: 0, allowedCount: 0, errorCount: 0 }
    );

    // Get active agents count
    const activeAgents = await prisma.agent.count({
      where: {
        userId: req.user.id,
        status: 'ACTIVE',
      },
    });

    // Get policies count
    const policiesCount = await prisma.policy.count({
      where: {
        userId: req.user.id,
        enabled: true,
      },
    });

    // Get recent blocks
    const recentBlocks = await prisma.actionLog.findMany({
      where: {
        userId: req.user.id,
        decision: 'BLOCKED',
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        policy: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    res.json({
      summary: {
        ...totals,
        activeAgents,
        activePolicies: policiesCount,
        blockRate: totals.checksCount > 0
          ? ((totals.blockedCount / totals.checksCount) * 100).toFixed(2)
          : '0.00',
      },
      dailyMetrics: metrics,
      recentBlocks,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch analytics',
    });
  }
});

/**
 * GET /v1/analytics/agents
 * Get per-agent analytics
 */
router.get('/analytics/agents', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const agents = await prisma.agent.findMany({
      where: { userId: req.user.id },
    });

    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const logs = await prisma.actionLog.groupBy({
          by: ['decision'],
          where: { agentId: agent.id },
          _count: true,
        });

        const stats = logs.reduce(
          (acc, log) => {
            acc[log.decision.toLowerCase()] = log._count;
            return acc;
          },
          { allowed: 0, blocked: 0, error: 0 } as any
        );

        return {
          agent: {
            id: agent.id,
            name: agent.name,
            status: agent.status,
            lastSeenAt: agent.lastSeenAt,
          },
          stats,
        };
      })
    );

    res.json({ agents: agentStats });
  } catch (error) {
    logger.error('Error fetching agent analytics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch agent analytics',
    });
  }
});

/**
 * GET /v1/admin/launch-metrics
 * Admin-only launch funnel and revenue snapshot.
 */
router.get('/admin/launch-metrics', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!isAdminEmail(req.user.email)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }

    const now = new Date();
    const days = Number.parseInt((req.query.days as string) || '30', 10);
    const windowDays = Number.isFinite(days) && days > 0 ? Math.min(days, 180) : 30;
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const [
      signups,
      activatedUsers,
      usersWithChecks,
      usersWithPolicies,
      paidUsers,
      starterUsers,
      proUsers,
      enterpriseUsers,
      totalAuthorizeChecks,
      blockedChecks,
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: windowStart } },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: windowStart },
          agents: { some: {} },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: windowStart },
          actionLogs: { some: {} },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: windowStart },
          policies: { some: {} },
        },
      }),
      prisma.user.count({
        where: { tier: { in: ['STARTER', 'PRO', 'ENTERPRISE'] } },
      }),
      prisma.user.count({ where: { tier: 'STARTER' } }),
      prisma.user.count({ where: { tier: 'PRO' } }),
      prisma.user.count({ where: { tier: 'ENTERPRISE' } }),
      prisma.actionLog.count({
        where: { timestamp: { gte: windowStart } },
      }),
      prisma.actionLog.count({
        where: { timestamp: { gte: windowStart }, decision: 'BLOCKED' },
      }),
    ]);

    const starterMrr = starterUsers * 29;
    const proMrr = proUsers * 79;
    const estimatedMrr = starterMrr + proMrr;

    const activationRate = signups > 0 ? (activatedUsers / signups) * 100 : 0;
    const policySetupRate = signups > 0 ? (usersWithPolicies / signups) * 100 : 0;
    const firstCheckRate = signups > 0 ? (usersWithChecks / signups) * 100 : 0;
    const blockRate = totalAuthorizeChecks > 0 ? (blockedChecks / totalAuthorizeChecks) * 100 : 0;

    res.json({
      window: {
        days: windowDays,
        start: windowStart.toISOString(),
        end: now.toISOString(),
      },
      funnel: {
        signups,
        activatedUsers,
        usersWithPolicies,
        usersWithChecks,
        activationRate: Number(activationRate.toFixed(2)),
        policySetupRate: Number(policySetupRate.toFixed(2)),
        firstCheckRate: Number(firstCheckRate.toFixed(2)),
      },
      usage: {
        totalAuthorizeChecks,
        blockedChecks,
        blockRate: Number(blockRate.toFixed(2)),
      },
      revenue: {
        paidUsers,
        starterUsers,
        proUsers,
        enterpriseUsers,
        estimatedMrrUsd: estimatedMrr,
      },
    });
  } catch (error) {
    logger.error('Error fetching launch metrics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch launch metrics',
    });
  }
});

export default router;
