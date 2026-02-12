// Type definitions for Bastion Backend

export interface AuthorizeRequest {
  api_key: string;
  agent_id?: string;
  action: Action;
}

export interface Action {
  type: ActionType;
  details: ActionDetails;
}

export type ActionType =
  | 'http_request'
  | 'https_connect'
  | 'file_write'
  | 'file_read'
  | 'file_delete'
  | 'shell_command'
  | 'subprocess'
  | 'database_query'
  | 'tool_call'
  | 'api_call';

export interface ActionDetails {
  // HTTP Request
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;

  // File Operations
  path?: string;
  mode?: string;
  content?: string;

  // Subprocess
  command?: string | string[];
  args?: string[];

  // Database
  query?: string;
  operation?: string;

  // Tool Call
  tool_name?: string;
  tool_args?: Record<string, any>;

  // Generic
  [key: string]: any;
}

export interface AuthorizeResponse {
  allowed: boolean;
  reason?: string;
  policy_id?: string;
  log_id?: string;
  latency_ms?: number;
}

export interface PolicyConfig {
  // Spending Limit
  max_amount?: number;
  currency?: string;
  window?: '1h' | '24h' | '7d' | '30d';

  // Rate Limit
  max_requests?: number;
  per?: '1m' | '1h' | '24h';

  // Pattern Match
  pattern?: string; // regex
  field?: string;
  match_type?: 'contains' | 'equals' | 'regex' | 'startsWith' | 'endsWith';

  // File Protection
  protected_paths?: string[];
  allowed_paths?: string[];

  // DLP (Data Loss Prevention)
  scan_patterns?: string[]; // regex patterns for PII, secrets, etc
  block_on_match?: boolean;
  use_builtin_patterns?: boolean;
  severity_threshold?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled_pattern_types?: string[];

  // Time Window
  allowed_hours?: { start: number; end: number }; // 0-23
  allowed_days?: number[]; // 0-6 (Sunday-Saturday)
  timezone?: string;

  // Allow/Block Lists
  allowed_values?: string[];
  blocked_values?: string[];

  // Custom Webhook
  webhook_url?: string;
  webhook_method?: 'GET' | 'POST';
  webhook_timeout_ms?: number;

  // Generic extensibility
  [key: string]: any;
}

export interface User {
  id: bigint;
  email: string;
  apiKey: string;
  tier: SubscriptionTier;
}

export type SubscriptionTier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface Policy {
  id: bigint;
  userId: bigint;
  agentId: bigint | null;
  name: string;
  type: PolicyType;
  config: PolicyConfig;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PolicyType =
  | 'SPENDING_LIMIT'
  | 'RATE_LIMIT'
  | 'PATTERN_MATCH'
  | 'FILE_PROTECTION'
  | 'DLP'
  | 'CUSTOM_WEBHOOK'
  | 'TIME_WINDOW'
  | 'ALLOWLIST'
  | 'BLOCKLIST';

export interface EvaluationResult {
  allowed: boolean;
  reason?: string;
  policyId?: bigint;
}

export interface EvaluationContext {
  user: User;
  agent: any | null;
  action: Action;
  policies: Policy[];
}
