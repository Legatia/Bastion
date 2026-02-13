// Usage Endpoint - Returns user's quota usage

import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { QuotaService } from '../services/quota-service';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * GET /v1/usage
 * Get user's current usage and quota limits
 */
router.get('/usage', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const usage = await QuotaService.getUsageSummary(req.user.id);

        res.json(usage);
    } catch (error) {
        logger.error('Error fetching usage:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch usage',
        });
    }
});

export default router;
