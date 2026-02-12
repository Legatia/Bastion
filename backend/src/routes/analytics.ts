// Analytics Endpoints

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateApiKey } from '../middleware/auth';

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
    console.error('Error fetching analytics:', error);
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
    console.error('Error fetching agent analytics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch agent analytics',
    });
  }
});

export default router;
