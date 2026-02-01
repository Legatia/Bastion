// Authentication Middleware

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        apiKey: string;
        tier: string;
        trialEndsAt: Date | null;
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

    // Look up user by API key
    const user = await prisma.user.findUnique({
      where: { apiKey: apiKey as string },
      select: {
        id: true,
        email: true,
        apiKey: true,
        tier: true,
        trialEndsAt: true,
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
    req.user = user;
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
export function requireTier(minTier: 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE') {
  const tierLevels = {
    STARTER: 1,
    GROWTH: 2,
    PRO: 3,
    ENTERPRISE: 4,
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
