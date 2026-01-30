// Authorization Endpoint - Core Policy Check API

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { policyEvaluator } from '../services/policy-evaluator';
import { authenticateApiKey } from '../middleware/auth';
import { AuthorizeRequest, AuthorizeResponse } from '../types';
import { QuotaService } from '../services/quota-service';

const router = Router();
const prisma = new PrismaClient();

// Request validation schema
const authorizeSchema = z.object({
  api_key: z.string().optional(), // Can come from body or header
  agent_id: z.string().uuid().optional(),
  action: z.object({
    type: z.string(),
    details: z.record(z.any()),
  }),
});

/**
 * POST /v1/authorize
 * Main endpoint for policy evaluation
 */
router.post('/authorize', authenticateApiKey, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate request
    const validated = authorizeSchema.parse(req.body);
    const { agent_id, action } = validated;

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // *** QUOTA CHECK ***
    const quotaCheck = await QuotaService.checkDailyLimit(req.user.id);
    if (!quotaCheck.allowed) {
      return res.status(403).json({
        allowed: false,
        error: 'QUOTA_EXCEEDED',
        reason: quotaCheck.message,
        quota: {
          current: quotaCheck.current,
          max: quotaCheck.max,
        },
      });
    }

    // Fetch user's active policies
    const policies = await prisma.policy.findMany({
      where: {
        userId: req.user.id,
        enabled: true,
      },
      orderBy: {
        priority: 'desc',
      },
    });

    // Evaluate action against policies
    const result = await policyEvaluator.evaluate({
      user: req.user as any,
      action: action as any,
      policies: policies as any,
      agent: agent_id as any,
    });

    const latencyMs = Date.now() - startTime;

    // Log the action
    const actionLog = await prisma.actionLog.create({
      data: {
        userId: req.user.id,
        agentId: agent_id,
        policyId: result.policyId?.toString() || null,
        actionType: action.type,
        actionData: action.details,
        decision: result.allowed ? 'ALLOWED' : 'BLOCKED',
        reason: result.reason,
        latencyMs,
      },
    });

    // Update usage metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.usageMetric.upsert({
      where: {
        userId_date: {
          userId: req.user.id,
          date: today,
        },
      },
      create: {
        userId: req.user.id,
        date: today,
        checksCount: 1,
        blockedCount: result.allowed ? 0 : 1,
        allowedCount: result.allowed ? 1 : 0,
        totalLatencyMs: BigInt(latencyMs),
      },
      update: {
        checksCount: { increment: 1 },
        blockedCount: { increment: result.allowed ? 0 : 1 },
        allowedCount: { increment: result.allowed ? 1 : 0 },
        totalLatencyMs: { increment: BigInt(latencyMs) },
      },
    });

    // Return response
    const response: AuthorizeResponse = {
      allowed: result.allowed,
      reason: result.reason,
      policy_id: result.policyId?.toString(),
      log_id: actionLog.id,
      latency_ms: latencyMs,
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Authorization error:', error);

    // Validation error
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request format',
        details: error.errors,
      });
    }

    // Internal error
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to evaluate action',
    });
  }
});

export default router;
