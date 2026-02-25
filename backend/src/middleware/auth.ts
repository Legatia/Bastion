// Authentication Middleware

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from './logger';
import crypto from 'crypto';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        apiKey: string;
        tier: string;
      };
    }
  }
}

/**
 * Authenticate requests using API key
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract API key from headers ONLY (not from body for security)
    const apiKey =
      req.headers['x-api-key'] as string ||
      req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key must be provided in X-API-Key or Authorization header',
      });
    }

    const rawApiKey = apiKey as string;
    const key = crypto.createHash('sha256').update(`${process.env.JWT_SECRET || ''}:api-key:v2`).digest();
    const apiKeyHash = crypto.createHmac('sha256', key).update(rawApiKey).digest('hex');

    // Look up user by API key (legacy plaintext OR v2 hashed+encrypted envelope)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { apiKey: rawApiKey },
          { apiKey: { startsWith: `bstv2.${apiKeyHash}.` } },
        ],
      },
      select: {
        id: true,
        email: true,
        apiKey: true,
        tier: true,
      },
    });

    if (!user) {
      // Use generic error message to prevent API key enumeration
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed',
      });
    }

    // Attach user to request
    req.user = { ...user, apiKey: rawApiKey };
    next();
  } catch (error) {
    logger.error('[AUTH] Authentication error:', { error: error instanceof Error ? error.message : error });

    // Don't expose internal errors
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Check if user has access to specific tier features
 */
export function requireTier(minTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE') {
  const tierLevels: Record<string, number> = {
    FREE: 0,
    STARTER: 1,
    PRO: 2,
    ENTERPRISE: 3,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userLevel = tierLevels[req.user.tier as keyof typeof tierLevels] || 0;
    const requiredLevel = tierLevels[minTier];

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This feature requires ${minTier} tier or higher`,
      });
    }

    next();
  };
}
