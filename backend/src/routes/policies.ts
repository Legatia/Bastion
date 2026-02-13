// Policy Management Endpoints

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/auth';
import { logger } from '../middleware/logger';

const router = Router();

// Policy creation/update schema
const policySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum([
    'SPENDING_LIMIT',
    'RATE_LIMIT',
    'PATTERN_MATCH',
    'FILE_PROTECTION',
    'DLP',
    'CUSTOM_WEBHOOK',
    'TIME_WINDOW',
    'ALLOWLIST',
    'BLOCKLIST',
  ]),
  config: z.record(z.any()),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

/**
 * GET /v1/policies
 * List all policies for authenticated user
 */
router.get('/policies', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const policies = await prisma.policy.findMany({
      where: { userId: req.user.id },
      orderBy: { priority: 'desc' },
    });

    res.json({ policies });
  } catch (error) {
    logger.error('Error fetching policies:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch policies',
    });
  }
});

/**
 * GET /v1/policies/:id
 * Get a specific policy
 */
router.get('/policies/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const policy = await prisma.policy.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
    });

    if (!policy) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy not found',
      });
    }

    res.json({ policy });
  } catch (error) {
    logger.error('Error fetching policy:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch policy',
    });
  }
});

/**
 * POST /v1/policies
 * Create a new policy
 */
router.post('/policies', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request
    const validated = policySchema.parse(req.body);

    // Create policy
    const policy = await prisma.policy.create({
      data: {
        userId: req.user.id,
        name: validated.name,
        description: validated.description,
        type: validated.type,
        config: validated.config,
        enabled: validated.enabled ?? true,
        priority: validated.priority ?? 0,
      },
    });

    res.status(201).json({ policy });
  } catch (error: any) {
    logger.error('Error creating policy:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid policy data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create policy',
    });
  }
});

/**
 * PUT /v1/policies/:id
 * Update an existing policy
 */
router.put('/policies/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if policy exists and belongs to user
    const existing = await prisma.policy.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy not found',
      });
    }

    // Validate request
    const validated = policySchema.partial().parse(req.body);

    // Update policy
    const policy = await prisma.policy.update({
      where: { id: req.params.id as string },
      data: validated,
    });

    res.json({ policy });
  } catch (error: any) {
    logger.error('Error updating policy:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid policy data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update policy',
    });
  }
});

/**
 * DELETE /v1/policies/:id
 * Delete a policy
 */
router.delete('/policies/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if policy exists and belongs to user
    const existing = await prisma.policy.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy not found',
      });
    }

    // Delete policy
    await prisma.policy.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    logger.error('Error deleting policy:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete policy',
    });
  }
});

export default router;
