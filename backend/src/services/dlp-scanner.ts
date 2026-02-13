/**
 * Data Loss Prevention (DLP) Scanner
 * Comprehensive pattern library for detecting sensitive data
 */

import { logger } from '../middleware/logger';

export interface DLPMatch {
  type: string;
  pattern: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  matches: string[];
  redacted: string[];
}

export interface DLPScanResult {
  blocked: boolean;
  matches: DLPMatch[];
  summary: string;
}

type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface DLPPattern {
  name: string;
  pattern: RegExp;
  severity: SeverityLevel;
}

/**
 * Comprehensive DLP Pattern Library
 */
export const DLP_PATTERNS: Record<string, DLPPattern> = {
  // API Keys and Tokens
  OPENAI_API_KEY: {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{48}/g,
    severity: 'CRITICAL',
  },
  ANTHROPIC_API_KEY: {
    name: 'Anthropic API Key',
    pattern: /sk-ant-api03-[a-zA-Z0-9_-]{95}/g,
    severity: 'CRITICAL',
  },
  GENERIC_API_KEY: {
    name: 'Generic API Key',
    pattern: /[aA][pP][iI]_?[kK][eE][yY][\s:=]+["']?([a-zA-Z0-9_-]{32,})["']?/g,
    severity: 'HIGH',
  },
  AWS_ACCESS_KEY: {
    name: 'AWS Access Key',
    pattern: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    severity: 'CRITICAL',
  },
  AWS_SECRET_KEY: {
    name: 'AWS Secret Key',
    pattern: /aws_secret_access_key[\s:=]+["']?([a-zA-Z0-9/+=]{40})["']?/gi,
    severity: 'CRITICAL',
  },
  GITHUB_TOKEN: {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    severity: 'HIGH',
  },
  SLACK_TOKEN: {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/g,
    severity: 'HIGH',
  },
  STRIPE_KEY: {
    name: 'Stripe API Key',
    pattern: /(sk|pk)_(test|live)_[a-zA-Z0-9]{24,}/g,
    severity: 'CRITICAL',
  },
  JWT_TOKEN: {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    severity: 'MEDIUM',
  },
  BEARER_TOKEN: {
    name: 'Bearer Token',
    pattern: /[Bb]earer\s+[a-zA-Z0-9_\-\.=]{20,}/g,
    severity: 'HIGH',
  },

  // Credentials
  PASSWORD: {
    name: 'Password',
    pattern: /(password|passwd|pwd)[\s:=]+["']?([^"'\s]{8,})["']?/gi,
    severity: 'HIGH',
  },
  DATABASE_URL: {
    name: 'Database URL',
    pattern: /(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^\/]+\/\w+/gi,
    severity: 'CRITICAL',
  },
  CONNECTION_STRING: {
    name: 'Connection String',
    pattern: /(Server|Data Source|Host)=.*?(User\s*Id|Username|Uid)=.*?(Password|Pwd)=/gi,
    severity: 'CRITICAL',
  },

  // Personal Identifiable Information (PII)
  CREDIT_CARD: {
    name: 'Credit Card Number',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    severity: 'CRITICAL',
  },
  SSN: {
    name: 'Social Security Number',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: 'CRITICAL',
  },
  PHONE_NUMBER: {
    name: 'Phone Number',
    pattern: /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    severity: 'MEDIUM',
  },
  EMAIL_ADDRESS: {
    name: 'Email Address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'LOW',
  },
  IP_ADDRESS: {
    name: 'IP Address',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: 'LOW',
  },
  MAC_ADDRESS: {
    name: 'MAC Address',
    pattern: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g,
    severity: 'LOW',
  },

  // Cryptographic Keys
  PRIVATE_KEY: {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
    severity: 'CRITICAL',
  },
  SSH_KEY: {
    name: 'SSH Private Key',
    pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+OPENSSH\s+PRIVATE\s+KEY-----/gi,
    severity: 'CRITICAL',
  },
  PGP_KEY: {
    name: 'PGP Private Key',
    pattern: /-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----[\s\S]*?-----END\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----/gi,
    severity: 'CRITICAL',
  },

  // Cloud Provider Patterns
  GOOGLE_API_KEY: {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    severity: 'HIGH',
  },
  GOOGLE_OAUTH: {
    name: 'Google OAuth Token',
    pattern: /ya29\.[0-9A-Za-z_-]+/g,
    severity: 'HIGH',
  },
  AZURE_KEY: {
    name: 'Azure Key',
    pattern: /[a-zA-Z0-9+/]{40}==/g,
    severity: 'MEDIUM',
  },
  HEROKU_API_KEY: {
    name: 'Heroku API Key',
    pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    severity: 'HIGH',
  },

  // Financial Information
  IBAN: {
    name: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g,
    severity: 'HIGH',
  },
  ROUTING_NUMBER: {
    name: 'Bank Routing Number',
    pattern: /\b[0-9]{9}\b/g,
    severity: 'MEDIUM',
  },

  // Healthcare
  MEDICAL_RECORD: {
    name: 'Medical Record Number',
    pattern: /\b(MRN|Medical\s*Record\s*Number)[\s:]+[A-Z0-9-]{6,}\b/gi,
    severity: 'HIGH',
  },

  // URLs with credentials
  URL_WITH_CREDENTIALS: {
    name: 'URL with Credentials',
    pattern: /https?:\/\/[^:]+:[^@]+@[^\s]+/gi,
    severity: 'HIGH',
  },
};

/**
 * DLP Scanner Class
 */
export class DLPScanner {
  // Security limits to prevent ReDoS and resource exhaustion
  private static readonly MAX_CONTENT_SIZE = 1024 * 1024; // 1MB
  private static readonly SCAN_TIMEOUT = 5000; // 5 seconds

  /**
   * Scan content for sensitive data
   */
  static scan(
    content: string | null | undefined,
    enabledPatterns?: string[],
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): DLPScanResult {
    // Handle null/undefined content
    if (!content) {
      return {
        blocked: false,
        matches: [],
        summary: 'No sensitive data detected',
      };
    }

    // Enforce content size limit to prevent resource exhaustion
    if (content.length > this.MAX_CONTENT_SIZE) {
      logger.warn(`[DLP] Content too large: ${content.length} bytes (max: ${this.MAX_CONTENT_SIZE})`);
      return {
        blocked: true,
        matches: [],
        summary: `Content too large (${content.length} bytes). Maximum: ${this.MAX_CONTENT_SIZE} bytes.`,
      };
    }

    const matches: DLPMatch[] = [];
    let blocked = false;
    const startTime = Date.now();

    // Determine which patterns to check
    const patternsToCheck = enabledPatterns
      ? Object.entries(DLP_PATTERNS).filter(([key]) =>
          enabledPatterns.includes(key)
        )
      : Object.entries(DLP_PATTERNS);

    // Scan each pattern with timeout protection
    for (const [type, config] of patternsToCheck) {
      // Check for timeout to prevent ReDoS
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > this.SCAN_TIMEOUT) {
        logger.warn(`[DLP] Scan timeout after ${elapsedMs}ms`);
        return {
          blocked: true,
          matches,
          summary: `Scan timeout - content too complex. Scanned ${matches.length} patterns before timeout.`,
        };
      }

      // Filter by severity if specified
      if (severity && this.getSeverityLevel(config.severity) < this.getSeverityLevel(severity)) {
        continue;
      }

      // Use the pattern directly (it's already a RegExp)
      const found = content.match(config.pattern);

      if (found && found.length > 0) {
        matches.push({
          type: config.name,
          pattern: type,
          severity: config.severity,
          matches: found,
          redacted: found.map((m) => this.redact(m)),
        });

        // Block if HIGH or CRITICAL severity
        if (config.severity === 'HIGH' || config.severity === 'CRITICAL') {
          blocked = true;
        }
      }
    }

    return {
      blocked,
      matches,
      summary: this.generateSummary(matches),
    };
  }

  /**
   * Scan HTTP request for sensitive data
   */
  static scanHttpRequest(request: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  }): DLPScanResult {
    // Combine all parts of the request for scanning
    const parts: string[] = [];

    if (request.url) parts.push(request.url);
    if (request.headers) parts.push(JSON.stringify(request.headers));
    if (request.body) {
      if (typeof request.body === 'string') {
        parts.push(request.body);
      } else {
        parts.push(JSON.stringify(request.body));
      }
    }

    const content = parts.join('\n');
    return this.scan(content);
  }

  /**
   * Redact sensitive data
   */
  static redact(value: string): string {
    if (value.length <= 8) {
      return '***';
    }
    const keep = Math.min(4, Math.floor(value.length / 4));
    return value.substring(0, keep) + '***' + value.substring(value.length - keep);
  }

  /**
   * Generate human-readable summary
   */
  private static generateSummary(matches: DLPMatch[]): string {
    if (matches.length === 0) {
      return 'No sensitive data detected';
    }

    const types = matches.map((m) => m.type);
    const uniqueTypes = [...new Set(types)];

    if (uniqueTypes.length === 1) {
      return `Detected ${types.length} ${uniqueTypes[0]}${types.length > 1 ? 's' : ''}`;
    }

    return `Detected sensitive data: ${uniqueTypes.join(', ')}`;
  }

  /**
   * Convert severity to numeric level
   */
  private static getSeverityLevel(severity: string): number {
    switch (severity) {
      case 'CRITICAL':
        return 4;
      case 'HIGH':
        return 3;
      case 'MEDIUM':
        return 2;
      case 'LOW':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Get recommended action for severity
   */
  static getRecommendedAction(severity: string): 'BLOCK' | 'WARN' | 'LOG' {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'BLOCK';
      case 'MEDIUM':
        return 'WARN';
      case 'LOW':
      default:
        return 'LOG';
    }
  }
}

/**
 * Helper function for policy evaluator
 */
export function scanForSensitiveData(
  content: string | object,
  patterns?: string[]
): { blocked: boolean; reason?: string; details?: DLPMatch[] } {
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const result = DLPScanner.scan(contentStr, patterns);

  return {
    blocked: result.blocked,
    reason: result.blocked ? result.summary : undefined,
    details: result.matches,
  };
}
