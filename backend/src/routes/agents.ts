// Agent Management Endpoints

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/auth';
import { QuotaService } from '../services/quota-service';

const router = Router();
const prisma = new PrismaClient();

const agentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
});

/**
 * GET /v1/agents
 * List all agents for authenticated user
 */
router.get('/agents', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const agents = await prisma.agent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch agents',
    });
  }
});

/**
 * POST /v1/agents
 * Create a new agent
 */
router.post('/agents', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // *** QUOTA CHECK ***
    const quotaCheck = await QuotaService.checkAgentLimit(req.user.id);
    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: 'QUOTA_EXCEEDED',
        message: quotaCheck.message,
        quota: {
          current: quotaCheck.current,
          max: quotaCheck.max,
        },
      });
    }

    const validated = agentSchema.parse(req.body);

    const agent = await prisma.agent.create({
      data: {
        userId: req.user.id,
        ...validated,
      },
    });

    res.status(201).json({ agent });
  } catch (error: any) {
    console.error('Error creating agent:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid agent data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create agent',
    });
  }
});

/**
 * PUT /v1/agents/:id/heartbeat
 * Update agent last seen timestamp
 */
router.put('/agents/:id/heartbeat', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const agent = await prisma.agent.updateMany({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
      data: {
        lastSeenAt: new Date(),
        status: 'ACTIVE',
      },
    });

    if (agent.count === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
    }

    res.json({ message: 'Heartbeat recorded' });
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update heartbeat',
    });
  }
});

/**
 * DELETE /v1/agents/:id
 * Delete an agent
 */
router.delete('/agents/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const agent = await prisma.agent.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
    });

    if (!agent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
    }

    await prisma.agent.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete agent',
    });
  }
});

export default router;
