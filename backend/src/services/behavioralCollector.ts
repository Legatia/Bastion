/**
 * MoltMind Behavioral Collector
 * Captures behavioral signals from traffic passing through Bastion
 */

import { prisma } from '../lib/prisma';
import crypto from 'crypto';

export interface TrafficEvent {
    agentId: string;
    method: string;
    url: string;
    requestBody?: string;
    responseTimeMs?: number;
    sentimentScore?: number;
    topicTags?: string[];
}

// Topic classification rules: keyword patterns -> topic tag
const TOPIC_RULES: { pattern: RegExp; tag: string }[] = [
    // Finance & payments
    { pattern: /stripe|payment|invoice|billing|checkout|price|subscription|charge|refund|wallet|transfer|balance/i, tag: 'finance' },
    // Social & communication
    { pattern: /discord|slack|telegram|twitter|x\.com|linkedin|facebook|instagram|message|chat|post|comment|reply|mention/i, tag: 'social' },
    // Code & development
    { pattern: /github|gitlab|bitbucket|commit|pull.request|merge|branch|deploy|ci\/cd|pipeline|build|release/i, tag: 'development' },
    // AI & LLM
    { pattern: /openai|anthropic|gemini|claude|gpt|llama|completion|embedding|prompt|model|inference/i, tag: 'ai' },
    // Data & storage
    { pattern: /database|storage|bucket|s3|blob|upload|download|file|document|backup|query|sql/i, tag: 'data' },
    // Auth & security
    { pattern: /auth|login|token|oauth|credential|password|key|certificate|permission|role|session/i, tag: 'security' },
    // Email & notifications
    { pattern: /email|smtp|sendgrid|mailgun|notification|alert|webhook|subscribe|unsubscribe/i, tag: 'notifications' },
    // Search & analytics
    { pattern: /search|analytics|metric|track|event|log|monitor|report|dashboard|insight/i, tag: 'analytics' },
];

// Sentiment signal words (lightweight rule-based approach)
const POSITIVE_SIGNALS = /success|completed|approved|confirmed|created|updated|ok|active|healthy|resolved|delivered|accepted|enabled/gi;
const NEGATIVE_SIGNALS = /error|fail|denied|rejected|blocked|timeout|expired|invalid|unauthorized|forbidden|crash|abort|suspend|disable|revoke|delete|remove|kill|terminate/gi;
const DANGER_SIGNALS = /leak|exfiltrate|override|bypass|inject|exploit|escalat|brute.?force|malicious|suspicious/gi;

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

        // Compute sentiment and topics if not already provided
        const sentimentScore = event.sentimentScore ?? this.analyzeSentiment(event);
        const topicTags = event.topicTags?.length ? event.topicTags : this.classifyTopics(event);

        await prisma.behavioralEvent.create({
            data: {
                agentId: event.agentId,
                eventType: this.classifyEventType(event),
                endpoint: this.normalizeEndpoint(event.url),
                method: event.method,
                contentLength: event.requestBody?.length || null,
                contentHash,
                sentimentScore,
                topicTags,
                targetAgentId,
                responseTimeMs: event.responseTimeMs || null,
            },
        });
    }

    /**
     * Rule-based sentiment analysis on URL + request body.
     * Returns a score from -1.0 (hostile) to 1.0 (positive).
     * 0.0 = neutral / unknown.
     */
    private analyzeSentiment(event: TrafficEvent): number {
        const text = `${event.method} ${event.url} ${event.requestBody || ''}`;

        let score = 0;
        let signals = 0;

        // Count positive signals
        const positiveMatches = text.match(POSITIVE_SIGNALS);
        if (positiveMatches) {
            score += positiveMatches.length * 0.3;
            signals += positiveMatches.length;
        }

        // Count negative signals
        const negativeMatches = text.match(NEGATIVE_SIGNALS);
        if (negativeMatches) {
            score -= negativeMatches.length * 0.3;
            signals += negativeMatches.length;
        }

        // Danger signals weigh heavier
        const dangerMatches = text.match(DANGER_SIGNALS);
        if (dangerMatches) {
            score -= dangerMatches.length * 0.6;
            signals += dangerMatches.length;
        }

        // HTTP method hints
        if (event.method === 'DELETE') {
            score -= 0.2;
            signals++;
        } else if (event.method === 'POST') {
            // neutral-to-slightly-positive (creating something)
            score += 0.05;
            signals++;
        }

        if (signals === 0) return 0;

        // Clamp to [-1, 1]
        return Math.max(-1, Math.min(1, score));
    }

    /**
     * Classify topics based on URL and body keyword matching.
     * Returns array of topic tags.
     */
    private classifyTopics(event: TrafficEvent): string[] {
        const text = `${event.url} ${event.requestBody || ''}`;
        const tags = new Set<string>();

        for (const rule of TOPIC_RULES) {
            if (rule.pattern.test(text)) {
                tags.add(rule.tag);
            }
        }

        // Also derive topic from event type as fallback
        const eventType = this.classifyEventType(event);
        const typeToTopic: Record<string, string> = {
            payment: 'finance',
            message_send: 'social',
            code_action: 'development',
            llm_call: 'ai',
            social_post: 'social',
        };
        if (typeToTopic[eventType]) {
            tags.add(typeToTopic[eventType]);
        }

        return Array.from(tags);
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
        if (url.includes('sendgrid') || url.includes('mailgun') || url.includes('smtp')) {
            return 'email_send';
        }
        if (url.includes('s3') || url.includes('storage') || url.includes('blob')) {
            return 'file_access';
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
