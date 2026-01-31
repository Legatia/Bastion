// Action Logs Endpoints

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateApiKey } from '../middleware/auth';
import { EncryptionService } from '../services/encryption-service';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /v1/logs
 * Get action logs for authenticated user
 * Query params:
 *   - limit: number of logs to return (default 100, max 1000)
 *   - offset: pagination offset (default 0)
 *   - decision: filter by decision (ALLOWED | BLOCKED | ERROR)
 *   - agent_id: filter by agent
 *   - from: start date (ISO string)
 *   - to: end date (ISO string)
 *   - decrypt: boolean (default false) - decrypt action data using user's API key
 */
router.get('/logs', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse query params
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const decision = req.query.decision as string | undefined;
    const agentId = req.query.agent_id as string | undefined;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const shouldDecrypt = req.query.decrypt === 'true';

    // Build where clause
    const where: any = {
      userId: req.user.id,
    };

    if (decision) {
      where.decision = decision;
    }

    if (agentId) {
      where.agentId = agentId;
    }

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = from;
      if (to) where.timestamp.lte = to;
    }

    // Get logs
    const [logs, total] = await Promise.all([
      prisma.actionLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
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
      }),
      prisma.actionLog.count({ where }),
    ]);

    // Decrypt logs if requested
    const processedLogs = await Promise.all(logs.map(async (log) => {
      const logData = { ...log } as any;

      if (log.encryptedData) {
        if (shouldDecrypt) {
          // Decrypt using user's API key + user ID
          try {
            const decrypted = await EncryptionService.decrypt(
              log.encryptedData,
              req.user!.apiKey,
              req.user!.id
            );
            logData.actionData = decrypted;
            logData.encryptedData = undefined; // Remove encrypted data from response
            logData.encrypted = false;
          } catch (error) {
            console.error('Failed to decrypt log:', error);
            logData.actionData = { error: 'Decryption failed' };
            logData.encrypted = true;
          }
        } else {
          // Return encrypted preview
          logData.actionData = EncryptionService.getPreview(log.encryptedData);
          logData.encrypted = true;
          logData.encryptedData = undefined;
        }
      } else {
        // Legacy unencrypted data
        logData.encrypted = false;
      }

      return logData;
    }));

    res.json({
      logs: processedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch logs',
    });
  }
});

/**
 * GET /v1/logs/:id
 * Get a specific log entry
 */
router.get('/logs/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const log = await prisma.actionLog.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
      include: {
        agent: true,
        policy: true,
      },
    });

    if (!log) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Log entry not found',
      });
    }

    res.json({ log });
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch log',
    });
  }
});

export default router;
