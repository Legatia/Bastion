/**
 * MoltMind Scheduler
 * Runs periodic baseline recalculation, drift detection, and data cleanup
 * for all agents whose owner has MoltMind access (STARTER+ tier).
 */

import { prisma } from '../lib/prisma';
import { baselineEngine } from './baselineEngine';
import { driftDetector } from './driftDetector';
import { logger } from '../middleware/logger';
import { OnchainAttestationService } from './onchain-attestation-service';

// Intervals
const BASELINE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DRIFT_INTERVAL_MS = 60 * 60 * 1000;          // 1 hour
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;   // 24 hours

// Retention
const EVENT_RETENTION_DAYS = 30;
const HEALTH_SCORE_RETENTION_DAYS = 90;
const ALERT_RETENTION_DAYS = 90;

let baselineTimer: NodeJS.Timeout | null = null;
let driftTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let checkpointTimer: NodeJS.Timeout | null = null;

/**
 * Get all agent IDs belonging to users with MoltMind access (STARTER+ tier).
 */
async function getMoltMindAgents(): Promise<{ id: string; userId: string }[]> {
    const agents = await prisma.agent.findMany({
        where: {
            user: {
                tier: { in: ['STARTER', 'PRO', 'ENTERPRISE'] },
            },
        },
        select: { id: true, userId: true },
    });

    return agents;
}

/**
 * Recalculate baselines for all monitored agents.
 * Runs once per day.
 */
async function runBaselineRecalculation(): Promise<void> {
    try {
        const agentIds = await getMoltMindAgents();
        logger.info(`[MoltMind Scheduler] Baseline recalculation starting for ${agentIds.length} agents`);

        for (const agent of agentIds) {
            try {
                const hasData = await baselineEngine.hasEnoughData(agent.id);
                if (hasData) {
                    await baselineEngine.calculateBaseline(agent.id);
                }
            } catch (err) {
                logger.error(`[MoltMind Scheduler] Baseline error for agent ${agent.id}:`, err);
            }
        }

        logger.info(`[MoltMind Scheduler] Baseline recalculation complete`);
    } catch (err) {
        logger.error('[MoltMind Scheduler] Baseline batch error:', err);
    }
}

/**
 * Run drift detection for all monitored agents.
 * Runs once per hour.
 */
async function runDriftDetection(): Promise<void> {
    try {
        const agentIds = await getMoltMindAgents();
        logger.info(`[MoltMind Scheduler] Drift detection starting for ${agentIds.length} agents`);

        for (const agent of agentIds) {
            try {
                const result = await driftDetector.detectDrift(agent.id);
                if (result.hasDrift) {
                    logger.info(
                        `[MoltMind Scheduler] Drift detected for agent ${agent.id}: score=${result.overallScore}, alerts=${result.alerts.length}`
                    );
                }
            } catch (err) {
                logger.error(`[MoltMind Scheduler] Drift error for agent ${agent.id}:`, err);
            }
        }

        logger.info(`[MoltMind Scheduler] Drift detection complete`);
    } catch (err) {
        logger.error('[MoltMind Scheduler] Drift batch error:', err);
    }
}

/**
 * Clean up old data to prevent unbounded table growth.
 * Runs once per day.
 */
async function runDataCleanup(): Promise<void> {
    try {
        const eventCutoff = new Date();
        eventCutoff.setDate(eventCutoff.getDate() - EVENT_RETENTION_DAYS);

        const healthCutoff = new Date();
        healthCutoff.setDate(healthCutoff.getDate() - HEALTH_SCORE_RETENTION_DAYS);

        const alertCutoff = new Date();
        alertCutoff.setDate(alertCutoff.getDate() - ALERT_RETENTION_DAYS);

        const [events, scores, alerts, baselines] = await Promise.all([
            // Delete old behavioral events
            prisma.behavioralEvent.deleteMany({
                where: { timestamp: { lt: eventCutoff } },
            }),
            // Delete old health score history (keep latest per agent via upsert)
            prisma.agentHealthScore.deleteMany({
                where: { computedAt: { lt: healthCutoff } },
            }),
            // Delete old acknowledged alerts
            prisma.cognitiveAlert.deleteMany({
                where: {
                    createdAt: { lt: alertCutoff },
                    acknowledged: true,
                },
            }),
            // Delete inactive baselines older than retention
            prisma.agentBaseline.deleteMany({
                where: {
                    isActive: false,
                    createdAt: { lt: healthCutoff },
                },
            }),
        ]);

        logger.info(
            `[MoltMind Cleanup] Deleted: ${events.count} events, ${scores.count} health scores, ${alerts.count} alerts, ${baselines.count} old baselines`
        );
    } catch (err) {
        logger.error('[MoltMind Cleanup] Error:', err);
    }
}

/**
 * Commit periodic MoltMind health/integrity checkpoints on-chain.
 * Runs every ATTEST_HEALTH_INTERVAL_HOURS when enabled.
 */
async function runHealthCheckpointAttestation(): Promise<void> {
    try {
        if (!OnchainAttestationService.isHealthCheckpointEnabled()) {
            return;
        }

        const intervalHours = OnchainAttestationService.getHealthCheckpointIntervalHours();
        const minEvents = OnchainAttestationService.getHealthCheckpointMinEvents();

        const windowEnd = new Date();
        const windowStart = new Date(windowEnd);
        windowStart.setHours(windowStart.getHours() - intervalHours);

        const agents = await getMoltMindAgents();
        logger.info(
            `[MoltMind Scheduler] Health checkpoint attestation starting for ${agents.length} agents (window=${intervalHours}h)`
        );

        let submitted = 0;
        for (const agent of agents) {
            try {
                const [health, eventCount, unacknowledgedAlerts, highAlerts, criticalAlerts] = await Promise.all([
                    driftDetector.getHealthScore(agent.id),
                    prisma.behavioralEvent.count({
                        where: { agentId: agent.id, timestamp: { gte: windowStart, lte: windowEnd } },
                    }),
                    prisma.cognitiveAlert.count({
                        where: { agentId: agent.id, acknowledged: false },
                    }),
                    prisma.cognitiveAlert.count({
                        where: {
                            agentId: agent.id,
                            acknowledged: false,
                            severity: 'high',
                            createdAt: { gte: windowStart, lte: windowEnd },
                        },
                    }),
                    prisma.cognitiveAlert.count({
                        where: {
                            agentId: agent.id,
                            acknowledged: false,
                            severity: 'critical',
                            createdAt: { gte: windowStart, lte: windowEnd },
                        },
                    }),
                ]);

                if (eventCount < minEvents && highAlerts === 0 && criticalAlerts === 0) {
                    continue;
                }

                const txHash = await OnchainAttestationService.attestHealthCheckpoint({
                    userId: agent.userId,
                    agentId: agent.id,
                    intervalStartIso: windowStart.toISOString(),
                    intervalEndIso: windowEnd.toISOString(),
                    eventCount,
                    unacknowledgedAlerts,
                    highAlerts,
                    criticalAlerts,
                    healthScore: health?.score ?? null,
                    identityCoherence: health?.identityCoherence ?? null,
                    behavioralStability: health?.behavioralStability ?? null,
                    interactionHealth: health?.interactionHealth ?? null,
                    activeFlags: health?.flags || [],
                });

                if (txHash) {
                    submitted += 1;
                }
            } catch (err) {
                logger.error(`[MoltMind Scheduler] Health checkpoint error for agent ${agent.id}:`, err);
            }
        }

        logger.info(
            `[MoltMind Scheduler] Health checkpoint attestation complete (submitted=${submitted}, agents=${agents.length})`
        );
    } catch (err) {
        logger.error('[MoltMind Scheduler] Health checkpoint batch error:', err);
    }
}

/**
 * Start the MoltMind scheduler.
 * Call this once from the server startup.
 */
export function startMoltMindScheduler(): void {
    logger.info('[MoltMind Scheduler] Starting...');

    // Run baseline recalculation daily
    baselineTimer = setInterval(runBaselineRecalculation, BASELINE_INTERVAL_MS);

    // Run drift detection hourly
    driftTimer = setInterval(runDriftDetection, DRIFT_INTERVAL_MS);

    // Run data cleanup daily
    cleanupTimer = setInterval(runDataCleanup, CLEANUP_INTERVAL_MS);

    // Run health checkpoint attestation on a configurable cadence
    const checkpointIntervalHours = OnchainAttestationService.getHealthCheckpointIntervalHours();
    checkpointTimer = setInterval(runHealthCheckpointAttestation, checkpointIntervalHours * 60 * 60 * 1000);

    // Run initial drift detection after a short delay to let the server boot
    setTimeout(runDriftDetection, 30_000);

    // Run initial cleanup 2 minutes after boot
    setTimeout(runDataCleanup, 120_000);

    // Run first health checkpoint 5 minutes after boot
    setTimeout(runHealthCheckpointAttestation, 300_000);

    logger.info(
        `[MoltMind Scheduler] Active: drift every 1h, baseline every 24h, cleanup every 24h, health checkpoints every ${checkpointIntervalHours}h`
    );
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
export function stopMoltMindScheduler(): void {
    if (baselineTimer) {
        clearInterval(baselineTimer);
        baselineTimer = null;
    }
    if (driftTimer) {
        clearInterval(driftTimer);
        driftTimer = null;
    }
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    if (checkpointTimer) {
        clearInterval(checkpointTimer);
        checkpointTimer = null;
    }
    logger.info('[MoltMind Scheduler] Stopped');
}
