// Policy Management Endpoints

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/auth';
import { logger } from '../middleware/logger';
import { OnchainAttestationService } from '../services/onchain-attestation-service';

const router = Router();

// Policy creation/update schema
const policySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum([
    'SPENDING_LIMIT',
    'RATE_LIMIT',
    'PATTERN_MATCH',
    'FILE_PROTECTION',
    'DLP',
    'CUSTOM_WEBHOOK',
    'TIME_WINDOW',
    'ALLOWLIST',
    'BLOCKLIST',
  ]),
  config: z.record(z.any()),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

type PolicyInput = z.infer<typeof policySchema>;

const INDUSTRY_PROFILES: Record<string, {
  id: string;
  name: string;
  description: string;
  version: string;
  policies: PolicyInput[];
}> = {
  default: {
    id: 'default',
    name: 'Default Security Bundle',
    description: 'Balanced baseline guardrails for general autonomous agents.',
    version: '2026.02.22',
    policies: [
      {
        name: 'Default DLP Scanner',
        description: 'Block high-risk secrets and sensitive data leakage.',
        type: 'DLP',
        priority: 100,
        enabled: true,
        config: {
          use_builtin_patterns: true,
          severity_threshold: 'HIGH',
          block_on_match: true,
          enabled_pattern_types: [
            'OPENAI_API_KEY',
            'ANTHROPIC_API_KEY',
            'AWS_ACCESS_KEY',
            'STRIPE_KEY',
            'DATABASE_URL',
            'PRIVATE_KEY',
            'SSH_KEY',
            'CREDIT_CARD',
            'SSN',
          ],
        },
      },
      {
        name: 'Default Trusted Domains',
        description: 'Allow requests only to known AI/API providers.',
        type: 'ALLOWLIST',
        priority: 90,
        enabled: true,
        config: {
          allowed_values: [
            'api.openai.com',
            'api.anthropic.com',
            'api.stripe.com',
            'api.github.com',
          ],
        },
      },
      {
        name: 'Default Rate Limit',
        description: 'Contain runaway loop behavior.',
        type: 'RATE_LIMIT',
        priority: 80,
        enabled: true,
        config: {
          max_requests: 300,
          per: '1h',
        },
      },
      {
        name: 'Default Daily Spending Cap',
        description: 'Cap total spend per day.',
        type: 'SPENDING_LIMIT',
        priority: 80,
        enabled: true,
        config: {
          max_amount: 500,
          window: '24h',
        },
      },
    ],
  },
  accounting: {
    id: 'accounting',
    name: 'Accounting Safe Mode',
    description: 'Strict controls for bookkeeping and finance-adjacent automation.',
    version: '2026.02.22',
    policies: [
      {
        name: 'Accounting DLP Policy',
        description: 'Block financial and personal sensitive data exfiltration.',
        type: 'DLP',
        priority: 100,
        enabled: true,
        config: {
          use_builtin_patterns: true,
          severity_threshold: 'MEDIUM',
          block_on_match: true,
          enabled_pattern_types: [
            'OPENAI_API_KEY',
            'ANTHROPIC_API_KEY',
            'AWS_ACCESS_KEY',
            'STRIPE_KEY',
            'DATABASE_URL',
            'PRIVATE_KEY',
            'CREDIT_CARD',
            'SSN',
            'ROUTING_NUMBER',
            'IBAN',
            'EMAIL_ADDRESS',
            'PHONE_NUMBER',
          ],
        },
      },
      {
        name: 'Accounting Trusted Domains',
        description: 'Restrict outbound access to accounting and comms providers.',
        type: 'ALLOWLIST',
        priority: 90,
        enabled: true,
        config: {
          allowed_values: [
            'api.openai.com',
            'api.anthropic.com',
            'quickbooks.api.intuit.com',
            'api.xero.com',
            'api.stripe.com',
            'graph.microsoft.com',
            'gmail.googleapis.com',
          ],
        },
      },
      {
        name: 'Accounting Business Hours',
        description: 'Operate only during weekdays and standard office hours.',
        type: 'TIME_WINDOW',
        priority: 85,
        enabled: true,
        config: {
          allowed_hours: { start: 8, end: 19 },
          allowed_days: [1, 2, 3, 4, 5],
        },
      },
      {
        name: 'Accounting Rate Limit',
        description: 'Limit automated actions to prevent runaway workflows.',
        type: 'RATE_LIMIT',
        priority: 80,
        enabled: true,
        config: {
          max_requests: 120,
          per: '1h',
        },
      },
      {
        name: 'Accounting Daily Spending Cap',
        description: 'Conservative daily spend limit for financial workflows.',
        type: 'SPENDING_LIMIT',
        priority: 80,
        enabled: true,
        config: {
          max_amount: 150,
          window: '24h',
        },
      },
    ],
  },
};

const applyIndustryProfileSchema = z.object({
  replaceExistingTypes: z.boolean().optional().default(true),
  enabled: z.boolean().optional(),
});

const importIndustryProfileSchema = z.object({
  profileId: z.string().min(1).max(64).optional(),
  profileName: z.string().min(1).max(255).optional(),
  version: z.string().min(1).max(64).optional(),
  replaceExistingTypes: z.boolean().optional().default(true),
  enabled: z.boolean().optional(),
  policies: z.array(policySchema).min(1).max(100),
});

const exportProfilesQuerySchema = z.object({
  enabled_only: z.coerce.boolean().optional().default(true),
});

function buildProfileTag(
  profileId: string,
  version?: string,
  appliedAt?: string,
  source?: 'builtin' | 'import'
): string {
  const parts = [`Profile:${profileId}`];
  if (version) parts.push(`Version:${version}`);
  if (appliedAt) parts.push(`AppliedAt:${appliedAt}`);
  if (source) parts.push(`Source:${source}`);
  return `[${parts.join(';')}]`;
}

function parseProfileTag(description?: string | null): {
  profileId: string | null;
  version: string | null;
  appliedAt: string | null;
  source: string | null;
} {
  const desc = description || '';
  const match = desc.match(/\[(Profile:[^\]]+)\]/i);
  if (!match) {
    return { profileId: null, version: null, appliedAt: null, source: null };
  }

  const parts = match[1].split(';');
  const values: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...rest] = part.split(':');
    if (!key || rest.length === 0) continue;
    values[key.trim().toLowerCase()] = rest.join(':').trim();
  }

  return {
    profileId: values.profile?.toLowerCase() || null,
    version: values.version?.toLowerCase() || null,
    appliedAt: values.appliedat || null,
    source: values.source?.toLowerCase() || null,
  };
}

function stripProfileTags(description?: string | null): string {
  if (!description) return '';
  return description.replace(/\s*\[Profile:[^\]]+\]\s*/gi, ' ').replace(/\s+/g, ' ').trim();
}

function detectActiveProfileFromPolicies(
  descriptions: Array<{ description: string | null }>
): { activeProfileId: string | null; activeProfileVersion: string | null } {
  const profileHits: Record<string, number> = {};
  const versionHits: Record<string, number> = {};

  for (const policy of descriptions) {
    const parsed = parseProfileTag(policy.description);
    if (!parsed.profileId) continue;
    profileHits[parsed.profileId] = (profileHits[parsed.profileId] || 0) + 1;
    if (parsed.version) {
      versionHits[`${parsed.profileId}:${parsed.version}`] =
        (versionHits[`${parsed.profileId}:${parsed.version}`] || 0) + 1;
    }
  }

  const activeProfileId = Object.entries(profileHits)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const activeProfileVersion = activeProfileId
    ? Object.entries(versionHits)
      .filter(([key]) => key.startsWith(`${activeProfileId}:`))
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      ?.split(':')[1] || INDUSTRY_PROFILES[activeProfileId]?.version || null
    : null;

  return { activeProfileId, activeProfileVersion };
}

/**
 * GET /v1/policies
 * List all policies for authenticated user
 */
router.get('/policies', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const policies = await prisma.policy.findMany({
      where: { userId: req.user.id },
      orderBy: { priority: 'desc' },
    });

    res.json({ policies });
  } catch (error) {
    logger.error('Error fetching policies:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch policies',
    });
  }
});

/**
 * GET /v1/industry-profiles
 * List available industry profiles
 */
router.get('/industry-profiles', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userPolicies = await prisma.policy.findMany({
      where: { userId: req.user.id },
      select: { description: true },
    });

    const { activeProfileId, activeProfileVersion } = detectActiveProfileFromPolicies(userPolicies);

    const profiles = Object.values(INDUSTRY_PROFILES).map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      version: profile.version,
      policyCount: profile.policies.length,
    }));

    res.json({ profiles, activeProfileId, activeProfileVersion });
  } catch (error) {
    logger.error('Error listing industry profiles:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list industry profiles',
    });
  }
});

/**
 * GET /v1/industry-profiles/changelog
 * Return tenant-applied profile/version summary from policy tags
 */
router.get('/industry-profiles/changelog', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const policies = await prisma.policy.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const map = new Map<string, {
      profileId: string;
      version: string | null;
      source: string | null;
      policyCount: number;
      latestPolicyUpdateAt: string;
      latestAppliedAt: string | null;
    }>();

    for (const policy of policies) {
      const parsed = parseProfileTag(policy.description);
      if (!parsed.profileId) continue;

      const key = `${parsed.profileId}:${parsed.version || 'unknown'}`;
      const existing = map.get(key);
      const updatedAt = policy.updatedAt.toISOString();
      const appliedAt = parsed.appliedAt;

      if (!existing) {
        map.set(key, {
          profileId: parsed.profileId,
          version: parsed.version,
          source: parsed.source,
          policyCount: 1,
          latestPolicyUpdateAt: updatedAt,
          latestAppliedAt: appliedAt,
        });
      } else {
        existing.policyCount += 1;
        if (updatedAt > existing.latestPolicyUpdateAt) {
          existing.latestPolicyUpdateAt = updatedAt;
        }
        if (appliedAt && (!existing.latestAppliedAt || appliedAt > existing.latestAppliedAt)) {
          existing.latestAppliedAt = appliedAt;
        }
      }
    }

    const changelog = Array.from(map.values()).sort((a, b) =>
      (b.latestAppliedAt || b.latestPolicyUpdateAt).localeCompare(a.latestAppliedAt || a.latestPolicyUpdateAt)
    );

    res.json({ changelog });
  } catch (error) {
    logger.error('Error fetching industry profile changelog:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch profile changelog',
    });
  }
});

/**
 * POST /v1/industry-profiles/:profileId/apply
 * Apply an industry profile as an overlay to the current user's policies
 */
router.post('/industry-profiles/:profileId/apply', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profileId = req.params.profileId as string;
    const profile = INDUSTRY_PROFILES[profileId];
    if (!profile) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Unknown profile: ${profileId}`,
      });
    }

    const { replaceExistingTypes, enabled } = applyIndustryProfileSchema.parse(req.body ?? {});

    const appliedAt = new Date().toISOString();
    const existingPolicies = await prisma.policy.findMany({
      where: { userId: req.user.id },
      orderBy: { priority: 'desc' },
    });

    const created: string[] = [];
    const updated: string[] = [];

    for (const profilePolicy of profile.policies) {
      const sameTypePolicies = replaceExistingTypes
        ? existingPolicies.filter((p) => p.type === profilePolicy.type)
        : [];
      const existing = sameTypePolicies[0] || null;

      const policyData = {
        name: profilePolicy.name,
        description: `${stripProfileTags(profilePolicy.description)} ${buildProfileTag(profile.id, profile.version, appliedAt, 'builtin')}`.trim(),
        type: profilePolicy.type,
        config: profilePolicy.config,
        enabled: enabled ?? (profilePolicy.enabled ?? true),
        priority: profilePolicy.priority ?? 0,
      };

      if (existing) {
        const policy = await prisma.policy.update({
          where: { id: existing.id },
          data: policyData,
        });
        updated.push(policy.id);
        OnchainAttestationService.attestPolicyChange({
          userId: req.user.id,
          policyId: policy.id,
          eventType: 'UPDATED',
          policyType: policy.type,
          name: policy.name,
          config: policy.config,
        }).catch((err) => logger.error('[ATTEST] Profile policy update attestation failed:', err));

        // Disable duplicate same-type policies to avoid conflicting policy stacks.
        if (sameTypePolicies.length > 1) {
          const duplicateIds = sameTypePolicies.slice(1).map((p) => p.id);
          await prisma.policy.updateMany({
            where: { id: { in: duplicateIds } },
            data: { enabled: false },
          });
        }
      } else {
        const policy = await prisma.policy.create({
          data: {
            userId: req.user.id,
            ...policyData,
          },
        });
        created.push(policy.id);
        OnchainAttestationService.attestPolicyChange({
          userId: req.user.id,
          policyId: policy.id,
          eventType: 'CREATED',
          policyType: policy.type,
          name: policy.name,
          config: policy.config,
        }).catch((err) => logger.error('[ATTEST] Profile policy create attestation failed:', err));
      }
    }

    res.json({
      profile: {
        id: profile.id,
        name: profile.name,
        version: profile.version,
      },
      replaceExistingTypes,
      createdCount: created.length,
      updatedCount: updated.length,
      policyIds: { created, updated },
    });
  } catch (error: any) {
    logger.error('Error applying industry profile:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid profile apply payload',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to apply industry profile',
    });
  }
});

/**
 * GET /v1/industry-profiles/export
 * Export current tenant profile pack as JSON bundle.
 */
router.get('/industry-profiles/export', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { enabled_only } = exportProfilesQuerySchema.parse(req.query || {});
    const policies = await prisma.policy.findMany({
      where: {
        userId: req.user.id,
        ...(enabled_only ? { enabled: true } : {}),
      },
      orderBy: { priority: 'desc' },
    });

    const { activeProfileId, activeProfileVersion } = detectActiveProfileFromPolicies(
      policies.map((p) => ({ description: p.description }))
    );

    const exportedAt = new Date().toISOString();
    const profileId = activeProfileId || 'custom';
    const version = activeProfileVersion || exportedAt.slice(0, 10).replace(/-/g, '.');

    res.json({
      profile: {
        id: profileId,
        name: INDUSTRY_PROFILES[profileId]?.name || 'Custom Profile',
        version,
        source: 'export',
      },
      exportedAt,
      enabledOnly: enabled_only,
      policies: policies.map((p) => ({
        name: p.name,
        description: stripProfileTags(p.description),
        type: p.type,
        config: p.config,
        enabled: p.enabled,
        priority: p.priority,
      })),
    });
  } catch (error: any) {
    logger.error('Error exporting industry profile bundle:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid export query params',
        details: error.errors,
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export profile bundle',
    });
  }
});

/**
 * POST /v1/industry-profiles/import
 * Import a tenant-specific profile bundle and apply to current user.
 */
router.post('/industry-profiles/import', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = importIndustryProfileSchema.parse(req.body);
    const profileId = (validated.profileId || 'imported').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
    const profileName = validated.profileName || 'Imported Profile';
    const version = validated.version || new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const appliedAt = new Date().toISOString();

    const existingPolicies = await prisma.policy.findMany({
      where: { userId: req.user.id },
      orderBy: { priority: 'desc' },
    });

    const created: string[] = [];
    const updated: string[] = [];

    for (const importedPolicy of validated.policies) {
      const sameTypePolicies = validated.replaceExistingTypes
        ? existingPolicies.filter((p) => p.type === importedPolicy.type)
        : [];
      const existing = sameTypePolicies[0] || null;

      const data = {
        name: importedPolicy.name,
        description: `${stripProfileTags(importedPolicy.description)} ${buildProfileTag(profileId, version, appliedAt, 'import')}`.trim(),
        type: importedPolicy.type,
        config: importedPolicy.config,
        enabled: validated.enabled ?? (importedPolicy.enabled ?? true),
        priority: importedPolicy.priority ?? 0,
      };

      if (existing) {
        const policy = await prisma.policy.update({
          where: { id: existing.id },
          data,
        });
        updated.push(policy.id);
        OnchainAttestationService.attestPolicyChange({
          userId: req.user.id,
          policyId: policy.id,
          eventType: 'UPDATED',
          policyType: policy.type,
          name: policy.name,
          config: policy.config,
        }).catch((err) => logger.error('[ATTEST] Import policy update attestation failed:', err));

        if (sameTypePolicies.length > 1) {
          const duplicateIds = sameTypePolicies.slice(1).map((p) => p.id);
          await prisma.policy.updateMany({
            where: { id: { in: duplicateIds } },
            data: { enabled: false },
          });
        }
      } else {
        const policy = await prisma.policy.create({
          data: {
            userId: req.user.id,
            ...data,
          },
        });
        created.push(policy.id);
        OnchainAttestationService.attestPolicyChange({
          userId: req.user.id,
          policyId: policy.id,
          eventType: 'CREATED',
          policyType: policy.type,
          name: policy.name,
          config: policy.config,
        }).catch((err) => logger.error('[ATTEST] Import policy create attestation failed:', err));
      }
    }

    res.json({
      profile: {
        id: profileId,
        name: profileName,
        version,
        source: 'import',
      },
      createdCount: created.length,
      updatedCount: updated.length,
      policyIds: { created, updated },
    });
  } catch (error: any) {
    logger.error('Error importing industry profile bundle:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid import payload',
        details: error.errors,
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to import profile bundle',
    });
  }
});

/**
 * GET /v1/policies/:id
 * Get a specific policy
 */
router.get('/policies/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const policy = await prisma.policy.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
    });

    if (!policy) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy not found',
      });
    }

    res.json({ policy });
  } catch (error) {
    logger.error('Error fetching policy:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch policy',
    });
  }
});

/**
 * POST /v1/policies
 * Create a new policy
 */
router.post('/policies', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request
    const validated = policySchema.parse(req.body);

    // Create policy
    const policy = await prisma.policy.create({
      data: {
        userId: req.user.id,
        name: validated.name,
        description: validated.description,
        type: validated.type,
        config: validated.config,
        enabled: validated.enabled ?? true,
        priority: validated.priority ?? 0,
      },
    });

    OnchainAttestationService.attestPolicyChange({
      userId: req.user.id,
      policyId: policy.id,
      eventType: 'CREATED',
      policyType: policy.type,
      name: policy.name,
      config: policy.config,
    }).catch((err) => logger.error('[ATTEST] Policy create attestation failed:', err));

    res.status(201).json({ policy });
  } catch (error: any) {
    logger.error('Error creating policy:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid policy data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create policy',
    });
  }
});

/**
 * PUT /v1/policies/:id
 * Update an existing policy
 */
router.put('/policies/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if policy exists and belongs to user
    const existing = await prisma.policy.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy not found',
      });
    }

    // Validate request
    const validated = policySchema.partial().parse(req.body);

    // Update policy
    const policy = await prisma.policy.update({
      where: { id: req.params.id as string },
      data: validated,
    });

    OnchainAttestationService.attestPolicyChange({
      userId: req.user.id,
      policyId: policy.id,
      eventType: 'UPDATED',
      policyType: policy.type,
      name: policy.name,
      config: policy.config,
    }).catch((err) => logger.error('[ATTEST] Policy update attestation failed:', err));

    res.json({ policy });
  } catch (error: any) {
    logger.error('Error updating policy:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid policy data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update policy',
    });
  }
});

/**
 * DELETE /v1/policies/:id
 * Delete a policy
 */
router.delete('/policies/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if policy exists and belongs to user
    const existing = await prisma.policy.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy not found',
      });
    }

    // Delete policy
    await prisma.policy.delete({
      where: { id: req.params.id as string },
    });

    OnchainAttestationService.attestPolicyChange({
      userId: req.user.id,
      policyId: existing.id,
      eventType: 'DELETED',
      policyType: existing.type,
      name: existing.name,
      config: existing.config,
    }).catch((err) => logger.error('[ATTEST] Policy delete attestation failed:', err));

    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    logger.error('Error deleting policy:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete policy',
    });
  }
});

export default router;
