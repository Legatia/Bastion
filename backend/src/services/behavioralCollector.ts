/**
 * MoltMind Behavioral Collector
 * Captures behavioral signals from traffic passing through Bastion
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface TrafficEvent {
    agentId: string;
    method: string;
    url: string;
    requestBody?: string;
    responseTimeMs?: number;
    sentimentScore?: number;
    topicTags?: string[];
}

export class BehavioralCollector {
    /**
     * Process every request passing through Bastion
     * Called from the authorize endpoint after policy evaluation
     */
    async collectEvent(event: TrafficEvent): Promise<void> {
        // Hash content for dedup (never store actual content)
        const contentHash = event.requestBody
            ? crypto.createHash('sha256').update(event.requestBody).digest('hex')
            : null;

        // Extract target agent ID if this is agent-to-agent interaction
        const targetAgentId = this.extractTargetAgent(event);

        await prisma.behavioralEvent.create({
            data: {
                agentId: event.agentId,
                eventType: this.classifyEventType(event),
                endpoint: this.normalizeEndpoint(event.url),
                method: event.method,
                contentLength: event.requestBody?.length || null,
                contentHash,
                sentimentScore: event.sentimentScore || null,
                topicTags: event.topicTags || [],
                targetAgentId,
                responseTimeMs: event.responseTimeMs || null,
            },
        });
    }

    /**
     * Classify event type based on URL patterns
     */
    private classifyEventType(event: TrafficEvent): string {
        const url = event.url.toLowerCase();

        if (url.includes('stripe') || url.includes('payment') || url.includes('checkout')) {
            return 'payment';
        }
        if (url.includes('discord') || url.includes('slack') || url.includes('telegram')) {
            return 'message_send';
        }
        if (url.includes('github') || url.includes('gitlab') || url.includes('bitbucket')) {
            return 'code_action';
        }
        if (url.includes('openai') || url.includes('anthropic') || url.includes('gemini')) {
            return 'llm_call';
        }
        if (url.includes('twitter') || url.includes('x.com') || url.includes('linkedin')) {
            return 'social_post';
        }

        return 'api_call';
    }

    /**
     * Normalize endpoint URL for consistent grouping
     * Removes dynamic IDs and query params
     */
    private normalizeEndpoint(url: string): string {
        try {
            const parsed = new URL(url);
            // Remove dynamic IDs from path
            const normalizedPath = parsed.pathname
                .replace(/\/[0-9a-f-]{36}/g, '/:id') // UUIDs
                .replace(/\/\d+/g, '/:id'); // Numeric IDs
            return `${parsed.host}${normalizedPath}`;
        } catch {
            return url;
        }
    }

    /**
     * Try to extract target agent ID from request
     */
    private extractTargetAgent(event: TrafficEvent): string | null {
        try {
            if (event.requestBody) {
                const body = JSON.parse(event.requestBody);
                return body.targetAgentId || body.agentId || body.recipientId || null;
            }
        } catch {
            // Not JSON or no target agent
        }
        return null;
    }

    /**
     * Get event counts for an agent in a time window
     */
    async getEventCounts(
        agentId: string,
        hours: number = 24
    ): Promise<{ total: number; byType: Record<string, number> }> {
        const since = new Date();
        since.setHours(since.getHours() - hours);

        const events = await prisma.behavioralEvent.groupBy({
            by: ['eventType'],
            where: {
                agentId,
                timestamp: { gte: since },
            },
            _count: true,
        });

        const byType: Record<string, number> = {};
        let total = 0;
        for (const e of events) {
            byType[e.eventType] = e._count;
            total += e._count;
        }

        return { total, byType };
    }
}

export const behavioralCollector = new BehavioralCollector();
