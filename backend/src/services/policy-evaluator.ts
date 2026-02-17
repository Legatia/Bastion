// Policy Evaluation Engine
// Core logic for determining if an action should be allowed or blocked

import { prisma } from '../lib/prisma';
import dns from 'node:dns/promises';
import net from 'node:net';
import {
  Action,
  Policy,
  PolicyConfig,
  EvaluationResult,
  EvaluationContext,
} from '../types';
import { DLPScanner } from './dlp-scanner';
import { logger } from '../middleware/logger';

export class PolicyEvaluator {
  private static readonly FAIL_CLOSED_POLICY_TYPES = new Set([
    'DLP',
    'ALLOWLIST',
    'BLOCKLIST',
    'CUSTOM_WEBHOOK',
  ]);

  /**
   * Evaluate an action against all applicable policies
   */
  async evaluate(context: EvaluationContext): Promise<EvaluationResult> {
    const { policies, action } = context;

    // Sort policies by priority (higher first)
    const sortedPolicies = policies
      .filter((p) => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    // Evaluate each policy
    for (const policy of sortedPolicies) {
      const result = await this.evaluatePolicy(policy, action, context);

      // If blocked, stop immediately
      if (!result.allowed) {
        return result;
      }
    }

    // All policies passed (or no policies)
    return { allowed: true };
  }

  /**
   * Evaluate a single policy
   */
  private async evaluatePolicy(
    policy: Policy,
    action: Action,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    try {
      switch (policy.type) {
        case 'SPENDING_LIMIT':
          return await this.evaluateSpendingLimit(policy, action, context);

        case 'RATE_LIMIT':
          return await this.evaluateRateLimit(policy, action, context);

        case 'PATTERN_MATCH':
          return this.evaluatePatternMatch(policy, action);

        case 'FILE_PROTECTION':
          return this.evaluateFileProtection(policy, action);

        case 'DLP':
          return this.evaluateDLP(policy, action);

        case 'TIME_WINDOW':
          return this.evaluateTimeWindow(policy, action);

        case 'ALLOWLIST':
          return this.evaluateAllowlist(policy, action);

        case 'BLOCKLIST':
          return this.evaluateBlocklist(policy, action);

        case 'CUSTOM_WEBHOOK':
          return await this.evaluateCustomWebhook(policy, action);

        default:
          logger.warn(`Unknown policy type: ${policy.type}`);
          return { allowed: true };
      }
    } catch (error) {
      logger.error(`Error evaluating policy ${policy.id}:`, error);
      if (this.shouldFailClosed(policy.type)) {
        return {
          allowed: false,
          reason: `Policy evaluation error (blocked): ${policy.type}`,
          policyId: policy.id,
        };
      }
      return { allowed: true, reason: 'Policy evaluation error (allowed)' };
    }
  }

  private shouldFailClosed(policyType: string): boolean {
    const mode = (process.env.POLICY_FAIL_MODE || 'selective').toLowerCase();
    if (mode === 'open') return false;
    if (mode === 'closed') return true;
    return PolicyEvaluator.FAIL_CLOSED_POLICY_TYPES.has(policyType);
  }

  /**
   * Spending Limit Policy
   * Tracks spending over a time window
   */
  private async evaluateSpendingLimit(
    policy: Policy,
    action: Action,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    const config = policy.config as PolicyConfig;
    const { max_amount = 1000, window = '24h' } = config;

    // Extract amount from action
    const amount = this.extractAmount(action);
    if (amount === null) {
      return { allowed: true }; // Not a spending action
    }

    // Calculate time window
    const windowStart = this.getWindowStart(window);

    // Sum spending via DB aggregation on the dedicated spendingAmount column
    const result = await prisma.actionLog.aggregate({
      where: {
        userId: context.user.id.toString(),
        decision: 'ALLOWED',
        timestamp: { gte: windowStart },
        spendingAmount: { not: null },
      },
      _sum: { spendingAmount: true },
    });

    const totalSpent = result._sum.spendingAmount || 0;
    const newTotal = totalSpent + amount;

    if (newTotal > max_amount) {
      return {
        allowed: false,
        reason: `Spending limit exceeded ($${newTotal.toFixed(2)}/$${max_amount} in ${window})`,
        policyId: policy.id,
      };
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * Rate Limit Policy
   * Limits number of actions per time window
   */
  private async evaluateRateLimit(
    policy: Policy,
    _action: Action,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    const config = policy.config as PolicyConfig;
    const { max_requests = 100, per = '1h' } = config;

    const windowStart = this.getWindowStart(per);

    // Count actions in this window
    const count = await prisma.actionLog.count({
      where: {
        userId: context.user.id.toString(),
        timestamp: { gte: windowStart },
      },
    });

    if (count >= max_requests) {
      return {
        allowed: false,
        reason: `Rate limit exceeded (${count}/${max_requests} requests in ${per})`,
        policyId: policy.id,
      };
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * Pattern Match Policy
   * Uses regex to match against action data
   */
  private evaluatePatternMatch(
    policy: Policy,
    action: Action
  ): EvaluationResult {
    const config = policy.config as PolicyConfig;
    const { pattern, field, match_type = 'regex' } = config;

    if (!pattern) {
      return { allowed: true };
    }

    // Get the value to check
    const value = field
      ? this.getNestedValue(action.details, field)
      : JSON.stringify(action.details);

    if (typeof value !== 'string') {
      return { allowed: true };
    }

    let matches = false;

    switch (match_type) {
      case 'contains':
        matches = value.includes(pattern);
        break;
      case 'equals':
        matches = value === pattern;
        break;
      case 'startsWith':
        matches = value.startsWith(pattern);
        break;
      case 'endsWith':
        matches = value.endsWith(pattern);
        break;
      case 'regex':
      default:
        try {
          if (this.isUnsafeRegex(pattern)) {
            logger.warn(`[SECURITY] Rejected potentially catastrophic regex: ${pattern}`);
            return { allowed: true, reason: 'Regex pattern rejected (too complex)' };
          }
          const regex = new RegExp(pattern, 'i');
          matches = regex.test(value);
        } catch (e) {
          logger.error('Invalid regex pattern:', pattern);
          return { allowed: true };
        }
    }

    if (matches) {
      return {
        allowed: false,
        reason: `Pattern matched: "${pattern}"`,
        policyId: policy.id,
      };
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * File Protection Policy
   * Protects specific files/directories from modification
   */
  private evaluateFileProtection(
    policy: Policy,
    action: Action
  ): EvaluationResult {
    const config = policy.config as PolicyConfig;
    const { protected_paths = [], allowed_paths = [] } = config;

    // Only applies to file operations
    if (
      !['file_write', 'file_delete', 'file_read'].includes(action.type)
    ) {
      return { allowed: true };
    }

    const path = action.details.path;
    if (!path) {
      return { allowed: true };
    }

    // Check if path is in protected list
    const isProtected = protected_paths.some((protectedPath) =>
      path.startsWith(protectedPath)
    );

    if (isProtected) {
      // Check if explicitly allowed
      const isAllowed = allowed_paths.some((allowedPath) =>
        path.startsWith(allowedPath)
      );

      if (!isAllowed) {
        return {
          allowed: false,
          reason: `File operation blocked: ${path} is protected`,
          policyId: policy.id,
        };
      }
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * DLP (Data Loss Prevention) Policy
   * Scans for sensitive data patterns (PII, secrets, etc)
   */
  private evaluateDLP(policy: Policy, action: Action): EvaluationResult {
    const config = policy.config as PolicyConfig;
    const {
      scan_patterns = [],
      block_on_match = true,
      use_builtin_patterns = true,
      severity_threshold = 'MEDIUM',
      enabled_pattern_types = [],
    } = config;

    // Convert action to string for scanning
    const content = JSON.stringify(action.details);

    // Use built-in comprehensive patterns if enabled
    if (use_builtin_patterns) {
      const result = DLPScanner.scan(
        content,
        enabled_pattern_types.length > 0 ? enabled_pattern_types : undefined,
        severity_threshold
      );

      if (result.blocked) {
        return {
          allowed: false,
          reason: `DLP: ${result.summary}`,
          policyId: policy.id,
        };
      }
    }

    // Check custom patterns if provided
    if (scan_patterns && scan_patterns.length > 0) {
      for (const pattern of scan_patterns) {
        try {
          if (this.isUnsafeRegex(pattern)) {
            logger.warn(`[SECURITY] Rejected potentially catastrophic DLP regex: ${pattern}`);
            continue;
          }
          const regex = new RegExp(pattern, 'gi');
          const matches = content.match(regex);

          if (matches && matches.length > 0) {
            if (block_on_match) {
              return {
                allowed: false,
                reason: `DLP: Custom pattern matched (${matches.length} matches)`,
                policyId: policy.id,
              };
            }
          }
        } catch (e) {
          logger.error('Invalid DLP pattern:', pattern);
        }
      }
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * Time Window Policy
   * Only allows actions during specific hours/days
   */
  private evaluateTimeWindow(
    policy: Policy,
    _action: Action
  ): EvaluationResult {
    const config = policy.config as PolicyConfig;
    const { allowed_hours, allowed_days, timezone } = config;

    // Use user's configured timezone or fall back to UTC
    const now = new Date();
    let hour: number;
    let day: number;

    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hourCycle: 'h23',
        });
        const dayFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'short',
        });
        hour = parseInt(formatter.format(now), 10);
        const dayStr = dayFormatter.format(now);
        const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        day = dayMap[dayStr] ?? now.getDay();
      } catch {
        // Invalid timezone — fall back to server time
        logger.warn(`Invalid timezone in time window policy: ${timezone}`);
        hour = now.getHours();
        day = now.getDay();
      }
    } else {
      hour = now.getUTCHours();
      day = now.getUTCDay();
    }

    if (allowed_hours) {
      const { start, end } = allowed_hours;
      if (hour < start || hour >= end) {
        const tz = timezone || 'UTC';
        return {
          allowed: false,
          reason: `Action not allowed at this time (${hour}:00 ${tz}). Allowed: ${start}:00-${end}:00`,
          policyId: policy.id,
        };
      }
    }

    if (allowed_days && !allowed_days.includes(day)) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return {
        allowed: false,
        reason: `Action not allowed on ${dayNames[day]}`,
        policyId: policy.id,
      };
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * Allowlist Policy
   * Only allows specific values
   */
  private evaluateAllowlist(policy: Policy, action: Action): EvaluationResult {
    const config = policy.config as PolicyConfig;
    const { allowed_values = [] } = config;

    if (allowed_values.length === 0) {
      return { allowed: true };
    }

    // Match against extracted values only (not keys) to prevent false positives
    const values = this.extractStringValues(action.details).map((v) => v.toLowerCase());
    const isAllowed = allowed_values.some((allowed) =>
      values.some((v) => v.includes(allowed.toLowerCase()))
    );

    if (!isAllowed) {
      return {
        allowed: false,
        reason: 'Action not in allowlist',
        policyId: policy.id,
      };
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * Blocklist Policy
   * Blocks specific values
   */
  private evaluateBlocklist(policy: Policy, action: Action): EvaluationResult {
    const config = policy.config as PolicyConfig;
    const { blocked_values = [] } = config;

    // Match against extracted values only (not keys) to prevent false positives
    const values = this.extractStringValues(action.details).map((v) => v.toLowerCase());
    const isBlocked = blocked_values.some((blocked) =>
      values.some((v) => v.includes(blocked.toLowerCase()))
    );

    if (isBlocked) {
      return {
        allowed: false,
        reason: 'Action matches blocklist',
        policyId: policy.id,
      };
    }

    return { allowed: true, policyId: policy.id };
  }

  /**
   * Custom Webhook Policy
   * Calls external API for decision
   */
  private async evaluateCustomWebhook(
    policy: Policy,
    action: Action
  ): Promise<EvaluationResult> {
    const config = policy.config as PolicyConfig;
    const {
      webhook_url,
      webhook_method = 'POST',
      webhook_timeout_ms = 5000,
    } = config;

    if (!webhook_url) {
      return { allowed: true };
    }

    // SSRF protection: validate the webhook URL and DNS targets
    if (!(await this.isSafeWebhookUrl(webhook_url))) {
      logger.warn(`[SECURITY] Blocked SSRF attempt to: ${webhook_url}`);
      return { allowed: false, reason: 'Webhook URL blocked by security policy', policyId: policy.id };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), webhook_timeout_ms);

    try {
      const response = await fetch(webhook_url, {
        method: webhook_method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        signal: controller.signal,
        redirect: 'error',
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      const result = (await response.json()) as {
        allowed?: boolean;
        reason?: string;
      };

      return {
        allowed: result.allowed !== false,
        reason: result.reason,
        policyId: policy.id,
      };
    } catch (error) {
      logger.error('Webhook evaluation failed:', error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Validate that a webhook URL is safe (not targeting internal services).
   * Blocks private IPs, localhost, link-local, and cloud metadata endpoints.
   */
  private async isSafeWebhookUrl(urlStr: string): Promise<boolean> {
    try {
      const url = new URL(urlStr);

      // Enforce HTTPS in production. Allow HTTP only in local development.
      if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && url.protocol === 'http:')) {
        return false;
      }

      const hostname = url.hostname.toLowerCase();
      const port = url.port;

      // Restrict unexpected ports to reduce SSRF surface.
      if (port && !['80', '443'].includes(port)) {
        return false;
      }

      // Block localhost variants
      if (
        hostname === 'localhost' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local')
      ) {
        return false;
      }

      // Direct IP literal host
      if (net.isIP(hostname)) {
        return !this.isPrivateOrReservedIp(hostname);
      }

      // Resolve DNS and reject hosts mapping to private/reserved ranges.
      const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
      if (!resolved.length) return false;

      for (const entry of resolved) {
        if (this.isPrivateOrReservedIp(entry.address)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private isPrivateOrReservedIp(ip: string): boolean {
    const normalized = ip.toLowerCase().split('%')[0];
    const version = net.isIP(normalized);
    if (!version) return true;

    if (version === 4) {
      const octets = normalized.split('.').map(Number);
      if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;
      const [a, b] = octets;
      if (a === 10) return true;                          // 10.0.0.0/8
      if (a === 127) return true;                         // 127.0.0.0/8
      if (a === 0) return true;                           // 0.0.0.0/8
      if (a === 169 && b === 254) return true;            // 169.254.0.0/16
      if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
      if (a === 192 && b === 168) return true;            // 192.168.0.0/16
      if (a === 100 && b >= 64 && b <= 127) return true;  // 100.64.0.0/10 (CGNAT)
      if (a >= 224) return true;                          // multicast/reserved
      return false;
    }

    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:')) return true;      // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice('::ffff:'.length);
      return this.isPrivateOrReservedIp(mapped);
    }
    return false;
  }

  // Helper methods

  private extractAmount(action: Action): number | null {
    const { details } = action;

    // Check common amount fields
    if (typeof details.amount === 'number') return details.amount;
    if (typeof details.value === 'number') return details.value;
    if (typeof details.price === 'number') return details.price;

    // Check in body for HTTP requests
    if (details.body) {
      if (typeof details.body.amount === 'number') return details.body.amount;
      if (typeof details.body.value === 'number') return details.body.value;
    }

    return null;
  }

  private getWindowStart(window: string): Date {
    const now = new Date();

    switch (window) {
      case '1m':
        return new Date(now.getTime() - 60 * 1000);
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Detect regex patterns that could cause catastrophic backtracking (ReDoS).
   * Rejects patterns with nested quantifiers like (a+)+, (a*)*b, (a|b+)+.
   */
  private isUnsafeRegex(pattern: string): boolean {
    // Nested quantifiers: a quantifier applied to a group that contains a quantifier
    // e.g. (a+)+, (.*a)*, ([^x]+)+
    if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) return true;
    // Alternation with overlapping quantified branches: (a+|a+)+
    if (/\([^)]*\|[^)]*\)[+*{]/.test(pattern) && /[+*]/.test(pattern)) return true;
    // Pattern length limit — very long patterns are suspicious
    if (pattern.length > 500) return true;
    return false;
  }

  /**
   * Recursively extract all string values from an object (ignoring keys).
   */
  private extractStringValues(obj: any): string[] {
    if (typeof obj === 'string') return [obj];
    if (Array.isArray(obj)) return obj.flatMap((v) => this.extractStringValues(v));
    if (obj && typeof obj === 'object') {
      return Object.values(obj).flatMap((v) => this.extractStringValues(v));
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') return [String(obj)];
    return [];
  }
}

export const policyEvaluator = new PolicyEvaluator();
