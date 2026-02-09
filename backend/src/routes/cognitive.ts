/**
 * MoltMind Cognitive Monitoring Routes
 * Endpoints for agent health scores, alerts, and baselines
 */

import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { driftDetector } from '../services/driftDetector';
import { baselineEngine } from '../services/baselineEngine';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /v1/agents/:id/health
 * Get current health score for an agent
 */
router.get(
    '/v1/agents/:id/health',
    authenticateApiKey,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const agentId = req.params.id as string;

            // Verify agent belongs to user
            const agent = await prisma.agent.findFirst({
                where: { id: agentId, userId: req.user!.id },
            });

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            // Get health score
            const health = await driftDetector.getHealthScore(agentId);

            if (!health) {
                // No health score yet, run drift detection
                const result = await driftDetector.detectDrift(agentId);
                return res.json({
                    score: result.overallScore,
                    identityCoherence: 50,
                    behavioralStability: 50,
                    interactionHealth: 50,
                    flags: result.alerts.map((a) => a.type),
                    status: 'computing',
                });
            }

            return res.json({
                ...health,
                status: 'ready',
            });
        } catch (error: any) {
            console.error('[MoltMind] Error getting health:', error);
            return res.status(500).json({ error: 'Failed to get health score' });
        }
    }
);

/**
 * GET /v1/agents/:id/alerts
 * Get cognitive alerts for an agent
 */
router.get(
    '/v1/agents/:id/alerts',
    authenticateApiKey,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const agentId = req.params.id as string;
            const limit = parseInt(req.query.limit as string) || 20;

            // Verify agent belongs to user
            const agent = await prisma.agent.findFirst({
                where: { id: agentId, userId: req.user!.id },
            });

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            const alerts = await driftDetector.getAlerts(agentId, limit);

            return res.json({ alerts });
        } catch (error: any) {
            console.error('[MoltMind] Error getting alerts:', error);
            return res.status(500).json({ error: 'Failed to get alerts' });
        }
    }
);

/**
 * POST /v1/agents/:id/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post(
    '/v1/agents/:id/alerts/:alertId/acknowledge',
    authenticateApiKey,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const agentId = req.params.id as string;
            const alertId = req.params.alertId as string;

            // Verify agent belongs to user
            const agent = await prisma.agent.findFirst({
                where: { id: agentId, userId: req.user!.id },
            });

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            // Verify alert belongs to agent
            const alert = await prisma.cognitiveAlert.findFirst({
                where: { id: alertId, agentId },
            });

            if (!alert) {
                return res.status(404).json({ error: 'Alert not found' });
            }

            await driftDetector.acknowledgeAlert(alertId);

            return res.json({ success: true });
        } catch (error: any) {
            console.error('[MoltMind] Error acknowledging alert:', error);
            return res.status(500).json({ error: 'Failed to acknowledge alert' });
        }
    }
);

/**
 * GET /v1/agents/:id/baseline
 * Get baseline metrics for an agent
 */
router.get(
    '/v1/agents/:id/baseline',
    authenticateApiKey,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const agentId = req.params.id as string;

            // Verify agent belongs to user
            const agent = await prisma.agent.findFirst({
                where: { id: agentId, userId: req.user!.id },
            });

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            const baseline = await baselineEngine.getBaseline(agentId);
            const hasEnoughData = await baselineEngine.hasEnoughData(agentId);

            if (!baseline) {
                return res.json({
                    status: hasEnoughData ? 'pending' : 'insufficient_data',
                    baseline: null,
                    message: hasEnoughData
                        ? 'Baseline is being calculated'
                        : 'Need at least 50 events to calculate baseline',
                });
            }

            return res.json({
                status: 'ready',
                baseline,
            });
        } catch (error: any) {
            console.error('[MoltMind] Error getting baseline:', error);
            return res.status(500).json({ error: 'Failed to get baseline' });
        }
    }
);

/**
 * POST /v1/agents/:id/baseline/refresh
 * Force recalculation of baseline
 */
router.post(
    '/v1/agents/:id/baseline/refresh',
    authenticateApiKey,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const agentId = req.params.id as string;

            // Verify agent belongs to user
            const agent = await prisma.agent.findFirst({
                where: { id: agentId, userId: req.user!.id },
            });

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            const baseline = await baselineEngine.calculateBaseline(agentId);

            if (!baseline) {
                return res.status(400).json({
                    error: 'Insufficient data',
                    message: 'Need at least 50 events to calculate baseline',
                });
            }

            return res.json({
                success: true,
                baseline,
            });
        } catch (error: any) {
            console.error('[MoltMind] Error refreshing baseline:', error);
            return res.status(500).json({ error: 'Failed to refresh baseline' });
        }
    }
);

/**
 * POST /v1/agents/:id/analyze
 * Run drift detection on demand
 */
router.post(
    '/v1/agents/:id/analyze',
    authenticateApiKey,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const agentId = req.params.id as string;
            const windowHours = parseInt(req.body.windowHours as string) || 24;

            // Verify agent belongs to user
            const agent = await prisma.agent.findFirst({
                where: { id: agentId, userId: req.user!.id },
            });

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            const result = await driftDetector.detectDrift(agentId, windowHours);

            return res.json(result);
        } catch (error: any) {
            console.error('[MoltMind] Error analyzing agent:', error);
            return res.status(500).json({ error: 'Failed to analyze agent' });
        }
    }
);

export default router;
