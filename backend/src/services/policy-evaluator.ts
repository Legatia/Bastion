// Policy Evaluation Engine
// Core logic for determining if an action should be allowed or blocked

import { PrismaClient } from '@prisma/client';
import {
  Action,
  Policy,
  PolicyConfig,
  EvaluationResult,
  EvaluationContext,
} from '../types';

const prisma = new PrismaClient();

export class PolicyEvaluator {
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
          console.warn(`Unknown policy type: ${policy.type}`);
          return { allowed: true };
      }
    } catch (error) {
      console.error(`Error evaluating policy ${policy.id}:`, error);
      // Fail open or closed? For now, fail open (allow)
      return { allowed: true, reason: 'Policy evaluation error' };
    }
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

    // Get total spending in this window
    const logs = await prisma.actionLog.findMany({
      where: {
        userId: context.user.id.toString(),
        decision: 'ALLOWED',
        timestamp: { gte: windowStart },
      },
    });

    const totalSpent = logs.reduce((sum, log) => {
      const logAmount = this.extractAmount({
        type: log.actionType as any,
        details: log.actionData as any,
      });
      return sum + (logAmount || 0);
    }, 0);

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
          const regex = new RegExp(pattern, 'i');
          matches = regex.test(value);
        } catch (e) {
          console.error('Invalid regex pattern:', pattern);
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

    // Import DLP scanner
    const { DLPScanner } = require('./dlp-scanner');

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
          console.error('Invalid DLP pattern:', pattern);
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
    const { allowed_hours, allowed_days } = config;

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    if (allowed_hours) {
      const { start, end } = allowed_hours;
      if (hour < start || hour >= end) {
        return {
          allowed: false,
          reason: `Action not allowed at this time (${hour}:00). Allowed: ${start}:00-${end}:00`,
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

    const actionStr = JSON.stringify(action.details).toLowerCase();
    const isAllowed = allowed_values.some((value) =>
      actionStr.includes(value.toLowerCase())
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

    const actionStr = JSON.stringify(action.details).toLowerCase();
    const isBlocked = blocked_values.some((value) =>
      actionStr.includes(value.toLowerCase())
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

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook_timeout_ms);

      const response = await fetch(webhook_url, {
        method: webhook_method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

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
      console.error('Webhook evaluation failed:', error);
      // Fail open (allow) on webhook error
      return { allowed: true, reason: 'Webhook timeout/error' };
    }
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
}

export const policyEvaluator = new PolicyEvaluator();
