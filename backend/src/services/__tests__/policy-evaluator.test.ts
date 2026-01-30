// Policy Evaluator Test Suite
// Tests for all policy types and evaluation logic

import { PolicyEvaluator } from '../policy-evaluator';
import { PrismaClient } from '@prisma/client';
import {
  Policy,
  Action,
  EvaluationContext,
} from '../../types';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    actionLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

const prisma = new PrismaClient();
const evaluator = new PolicyEvaluator();

describe('PolicyEvaluator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DLP Policy', () => {
    const dlpPolicy: Policy = {
      id: BigInt(1),
      userId: BigInt(1),
      agentId: null,
      name: 'DLP Scanner',
      type: 'DLP',
      enabled: true,
      priority: 100,
      config: {
        use_builtin_patterns: true,
        severity_threshold: 'MEDIUM',
        enabled_pattern_types: ['OPENAI_API_KEY', 'CREDIT_CARD'],
        block_on_match: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should block requests containing API keys', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          method: 'POST',
          url: 'https://api.example.com',
          body: 'sk-' + 'a'.repeat(48),
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [dlpPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DLP');
      expect(result.reason).toContain('OpenAI API Key');
    });

    it('should block requests containing credit cards', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          body: 'Card: 4532-1234-5678-9010',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [dlpPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Credit Card');
    });

    it('should allow safe content', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          body: 'What is the weather today?',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [dlpPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true);
    });

    it('should respect severity threshold', async () => {
      const lowSeverityPolicy: Policy = {
        ...dlpPolicy,
        config: {
          use_builtin_patterns: true,
          severity_threshold: 'HIGH',
          block_on_match: true,
        },
      };

      const action: Action = {
        type: 'http_request',
        details: {
          body: 'user@example.com', // LOW severity
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [lowSeverityPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true); // Not blocked due to HIGH threshold
    });

    it('should use custom patterns', async () => {
      const customPolicy: Policy = {
        ...dlpPolicy,
        config: {
          use_builtin_patterns: false,
          scan_patterns: ['INTERNAL-KEY-[A-Z0-9]{16}'],
          block_on_match: true,
        },
      };

      const action: Action = {
        type: 'http_request',
        details: {
          body: 'INTERNAL-KEY-ABC123DEF4567890',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [customPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Custom pattern matched');
    });
  });

  describe('Allowlist Policy', () => {
    const allowlistPolicy: Policy = {
      id: BigInt(2),
      userId: BigInt(1),
      agentId: null,
      name: 'Trusted APIs',
      type: 'ALLOWLIST',
      enabled: true,
      priority: 90,
      config: {
        allowed_values: [
          'api.openai.com',
          'api.anthropic.com',
          'api.telegram.org',
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow whitelisted domains', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          url: 'https://api.openai.com/v1/chat',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [allowlistPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true);
    });

    it('should block non-whitelisted domains', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          url: 'https://malicious-site.com/steal',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [allowlistPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Action not in allowlist');
    });
  });

  describe('Rate Limit Policy', () => {
    const rateLimitPolicy: Policy = {
      id: BigInt(3),
      userId: BigInt(1),
      agentId: null,
      name: 'API Rate Limit',
      type: 'RATE_LIMIT',
      enabled: true,
      priority: 80,
      config: {
        max_requests: 100,
        per: '1h',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow requests under limit', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(50);

      const action: Action = {
        type: 'http_request',
        details: { url: 'https://api.example.com' },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [rateLimitPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true);
    });

    it('should block requests over limit', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(100);

      const action: Action = {
        type: 'http_request',
        details: { url: 'https://api.example.com' },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [rateLimitPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
      expect(result.reason).toContain('100/100');
    });
  });

  describe('Time Window Policy', () => {
    const timeWindowPolicy: Policy = {
      id: BigInt(4),
      userId: BigInt(1),
      agentId: null,
      name: 'Business Hours',
      type: 'TIME_WINDOW',
      enabled: true,
      priority: 70,
      config: {
        allowed_hours: { start: 9, end: 18 },
        allowed_days: [1, 2, 3, 4, 5], // Mon-Fri
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow actions during business hours', async () => {
      // Mock current time to be 10 AM on a weekday
      const mockDate = new Date('2024-01-15T10:00:00'); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const action: Action = {
        type: 'http_request',
        details: {},
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [timeWindowPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true);

      jest.restoreAllMocks();
    });

    it('should block actions outside business hours', async () => {
      // Mock current time to be 8 PM
      const mockDate = new Date('2024-01-15T20:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const action: Action = {
        type: 'http_request',
        details: {},
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [timeWindowPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed at this time');

      jest.restoreAllMocks();
    });

    it('should block actions on weekends', async () => {
      // Mock current time to be Sunday
      const mockDate = new Date('2024-01-14T10:00:00'); // Sunday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const action: Action = {
        type: 'http_request',
        details: {},
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [timeWindowPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Sun');

      jest.restoreAllMocks();
    });
  });

  describe('File Protection Policy', () => {
    const fileProtectionPolicy: Policy = {
      id: BigInt(5),
      userId: BigInt(1),
      agentId: null,
      name: 'Protect Sensitive Files',
      type: 'FILE_PROTECTION',
      enabled: true,
      priority: 95,
      config: {
        protected_paths: ['/etc', '/root', '/home/user/.ssh'],
        allowed_paths: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should block file operations on protected paths', async () => {
      const action: Action = {
        type: 'file_write',
        details: {
          path: '/etc/passwd',
          content: 'malicious',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [fileProtectionPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('protected');
    });

    it('should allow file operations on non-protected paths', async () => {
      const action: Action = {
        type: 'file_write',
        details: {
          path: '/home/user/documents/file.txt',
          content: 'safe content',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [fileProtectionPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Pattern Match Policy', () => {
    const patternPolicy: Policy = {
      id: BigInt(6),
      userId: BigInt(1),
      agentId: null,
      name: 'Block rm -rf',
      type: 'PATTERN_MATCH',
      enabled: true,
      priority: 85,
      config: {
        pattern: 'rm\\s+-rf',
        match_type: 'regex',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should block commands matching pattern', async () => {
      const action: Action = {
        type: 'shell_command',
        details: {
          command: 'rm -rf /',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [patternPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Pattern matched');
    });

    it('should use different match types', async () => {
      const containsPolicy: Policy = {
        ...patternPolicy,
        config: {
          pattern: 'DELETE',
          match_type: 'contains',
        },
      };

      const action: Action = {
        type: 'database_query',
        details: {
          query: 'DELETE FROM users WHERE id = 1',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [containsPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
    });
  });

  describe('Blocklist Policy', () => {
    const blocklistPolicy: Policy = {
      id: BigInt(7),
      userId: BigInt(1),
      agentId: null,
      name: 'Block Malicious Sites',
      type: 'BLOCKLIST',
      enabled: true,
      priority: 90,
      config: {
        blocked_values: ['malicious.com', 'evil-site.net', 'phishing.org'],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should block blacklisted domains', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          url: 'https://malicious.com/steal',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [blocklistPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Action matches blocklist');
    });

    it('should allow non-blacklisted domains', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          url: 'https://google.com',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [blocklistPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Policy Priority', () => {
    it('should evaluate policies in priority order', async () => {
      const highPriorityBlock: Policy = {
        id: BigInt(10),
        userId: BigInt(1),
        agentId: null,
        name: 'High Priority Block',
        type: 'BLOCKLIST',
        enabled: true,
        priority: 100,
        config: {
          blocked_values: ['blocked.com'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lowPriorityAllow: Policy = {
        id: BigInt(11),
        userId: BigInt(1),
        agentId: null,
        name: 'Low Priority Allow',
        type: 'ALLOWLIST',
        enabled: true,
        priority: 50,
        config: {
          allowed_values: ['blocked.com'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const action: Action = {
        type: 'http_request',
        details: {
          url: 'https://blocked.com',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [lowPriorityAllow, highPriorityBlock], // Order doesn't matter
      };

      const result = await evaluator.evaluate(context);

      // High priority blocklist should win
      expect(result.allowed).toBe(false);
      expect(result.policyId).toBe(highPriorityBlock.id);
    });
  });

  describe('Disabled Policies', () => {
    it('should skip disabled policies', async () => {
      const disabledPolicy: Policy = {
        id: BigInt(12),
        userId: BigInt(1),
        agentId: null,
        name: 'Disabled DLP',
        type: 'DLP',
        enabled: false,
        priority: 100,
        config: {
          use_builtin_patterns: true,
          block_on_match: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const action: Action = {
        type: 'http_request',
        details: {
          body: 'sk-' + 'a'.repeat(48),
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [disabledPolicy],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true); // Policy is disabled
    });
  });

  describe('No Policies', () => {
    it('should allow all actions when no policies exist', async () => {
      const action: Action = {
        type: 'http_request',
        details: {
          url: 'https://anywhere.com',
        },
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [],
      };

      const result = await evaluator.evaluate(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should fail open on policy evaluation error', async () => {
      const brokenPolicy: Policy = {
        id: BigInt(13),
        userId: BigInt(1),
        agentId: null,
        name: 'Broken Policy',
        type: 'CUSTOM_WEBHOOK' as any,
        enabled: true,
        priority: 100,
        config: {
          webhook_url: 'http://invalid-url-that-will-timeout',
          webhook_timeout_ms: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const action: Action = {
        type: 'http_request',
        details: {},
      };

      const context: EvaluationContext = {
        user: { id: BigInt(1), email: 'test@example.com' } as any,
        agent: null,
        action,
        policies: [brokenPolicy],
      };

      const result = await evaluator.evaluate(context);

      // Should fail open (allow) on webhook error
      expect(result.allowed).toBe(true);
    });
  });
});
