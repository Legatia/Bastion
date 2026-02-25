import crypto from 'crypto';
import { encodeFunctionData, parseAbi, type Hex } from 'viem';
import { CdpWalletService } from './cdp-wallet-service';
import { logger } from '../middleware/logger';
import { prisma } from '../lib/prisma';

const ATTESTATION_ABI = parseAbi([
  'function attestPolicy(bytes32 digest,string userId,string policyId,string eventType) external',
  'function attestDecision(bytes32 digest,string userId,string agentId,string actionType,string decision,string logId) external',
]);

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function sortJson(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (typeof value === 'object') {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortJson((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return String(value);
}

function hashObject(value: unknown): Hex {
  const normalized = JSON.stringify(sortJson(value));
  return `0x${crypto.createHash('sha256').update(normalized).digest('hex')}` as Hex;
}

function getContractAddress(): `0x${string}` | null {
  const address = process.env.ATTESTATION_CONTRACT_ADDRESS;
  if (!address) return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    logger.warn('[ATTEST] Invalid ATTESTATION_CONTRACT_ADDRESS, disabling attestation');
    return null;
  }
  return address as `0x${string}`;
}

function getAttestationNetwork(): string {
  return process.env.ATTESTATION_NETWORK || 'avalanche';
}

function getAttestationWalletName(): string {
  return process.env.ATTESTATION_WALLET_NAME || 'bastion-attestor';
}

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

const CDP_SUPPORTED_EVM_NETWORKS = new Set([
  'base',
  'base-sepolia',
  'ethereum',
  'ethereum-sepolia',
  'avalanche',
  'polygon',
  'optimism',
  'arbitrum',
]);

function getMaxTxPerHour(): number {
  const parsed = Number.parseInt(process.env.ATTEST_MAX_TX_PER_HOUR || '400', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 400;
  return parsed;
}

function getMaxTxPerDay(): number {
  const parsed = Number.parseInt(process.env.ATTEST_MAX_TX_PER_DAY || '5000', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 5000;
  return parsed;
}

async function ensureAttestationBudgetTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS attestation_budget_counters (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function checkAndIncrementAttestBudget(): Promise<boolean> {
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const hourLimit = getMaxTxPerHour();
  const dayLimit = getMaxTxPerDay();

  try {
    await ensureAttestationBudgetTable();
    await prisma.$transaction(async (tx) => {
      const hourRows = await tx.$queryRaw<{ count: number }[]>`
        INSERT INTO attestation_budget_counters (key, count, updated_at)
        VALUES (${`hour:${hourKey}`}, 1, NOW())
        ON CONFLICT (key) DO UPDATE
        SET count = attestation_budget_counters.count + 1, updated_at = NOW()
        WHERE attestation_budget_counters.count < ${hourLimit}
        RETURNING count
      `;
      if (hourRows.length === 0) {
        throw new Error('HOUR_LIMIT_REACHED');
      }

      const dayRows = await tx.$queryRaw<{ count: number }[]>`
        INSERT INTO attestation_budget_counters (key, count, updated_at)
        VALUES (${`day:${dayKey}`}, 1, NOW())
        ON CONFLICT (key) DO UPDATE
        SET count = attestation_budget_counters.count + 1, updated_at = NOW()
        WHERE attestation_budget_counters.count < ${dayLimit}
        RETURNING count
      `;
      if (dayRows.length === 0) {
        throw new Error('DAY_LIMIT_REACHED');
      }
    });
    return true;
  } catch (error: any) {
    if (error?.message === 'HOUR_LIMIT_REACHED' || error?.message === 'DAY_LIMIT_REACHED') {
      return false;
    }
    logger.warn('[ATTEST] Budget counter storage unavailable, falling back to deny-safe budget mode', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function shouldSendAttestation(): Promise<{ ok: boolean; network?: string; reason?: string }> {
  const network = getAttestationNetwork();
  if (!CDP_SUPPORTED_EVM_NETWORKS.has(network)) {
    return {
      ok: false,
      network,
      reason: `ATTESTATION_NETWORK "${network}" is not supported by CDP sendTransaction`,
    };
  }

  if (!(await checkAndIncrementAttestBudget())) {
    return {
      ok: false,
      network,
      reason: 'Attestation tx cap reached (ATTEST_MAX_TX_PER_HOUR / ATTEST_MAX_TX_PER_DAY)',
    };
  }

  return { ok: true, network };
}

function shouldAnchorDecision(input: {
  decision: 'ALLOWED' | 'BLOCKED' | 'ERROR';
  actionType: string;
  spendingAmount: number | null;
}): boolean {
  if (input.decision === 'BLOCKED' || input.decision === 'ERROR') return true;
  if (typeof input.spendingAmount === 'number' && input.spendingAmount > 0) return true;

  const defaults = ['payment', 'transfer', 'withdraw', 'swap', 'wallet_transaction'];
  const configured = process.env.ATTEST_DECISION_ACTION_TYPES
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const criticalActions = configured && configured.length > 0 ? configured : defaults;
  return criticalActions.includes(input.actionType);
}

export class OnchainAttestationService {
  static isHealthCheckpointEnabled(): boolean {
    return envBool('ATTEST_HEALTH_ENABLED', false);
  }

  static getHealthCheckpointIntervalHours(): number {
    const parsed = Number.parseInt(process.env.ATTEST_HEALTH_INTERVAL_HOURS || '24', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 24;
    return Math.min(parsed, 24 * 7);
  }

  static getHealthCheckpointMinEvents(): number {
    const parsed = Number.parseInt(process.env.ATTEST_HEALTH_MIN_EVENTS || '10', 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 10;
    return parsed;
  }

  static async attestPolicyChange(input: {
    userId: string;
    policyId: string;
    eventType: 'CREATED' | 'UPDATED' | 'DELETED';
    policyType?: string;
    name?: string;
    config?: unknown;
  }): Promise<string | null> {
    const contractAddress = getContractAddress();
    if (!contractAddress) return null;
    const sendCheck = await shouldSendAttestation();
    if (!sendCheck.ok) {
      logger.warn('[ATTEST] Policy attestation skipped', {
        policyId: input.policyId,
        reason: sendCheck.reason,
      });
      return null;
    }

    const digest = hashObject({
      scope: 'policy',
      ...input,
      timestamp: new Date().toISOString(),
    });

    const data = encodeFunctionData({
      abi: ATTESTATION_ABI,
      functionName: 'attestPolicy',
      args: [digest, input.userId, input.policyId, input.eventType],
    });

    const tx = await CdpWalletService.sendNamedTransaction({
      walletName: getAttestationWalletName(),
      to: contractAddress,
      data,
      value: 0n,
      network: sendCheck.network as string,
    });

    logger.info('[ATTEST] Policy attestation submitted', {
      policyId: input.policyId,
      eventType: input.eventType,
      txHash: tx.transactionHash,
    });
    return tx.transactionHash;
  }

  static async attestDecisionReceipt(input: {
    userId: string;
    agentId: string | null;
    actionType: string;
    decision: 'ALLOWED' | 'BLOCKED' | 'ERROR';
    reason?: string | null;
    spendingAmount: number | null;
    policyId?: string | null;
    logId: string;
  }): Promise<string | null> {
    const contractAddress = getContractAddress();
    if (!contractAddress) return null;
    if (!shouldAnchorDecision(input)) return null;
    const sendCheck = await shouldSendAttestation();
    if (!sendCheck.ok) {
      logger.warn('[ATTEST] Decision attestation skipped', {
        logId: input.logId,
        reason: sendCheck.reason,
      });
      return null;
    }

    const digest = hashObject({
      scope: 'decision',
      ...input,
      timestamp: new Date().toISOString(),
    });

    const data = encodeFunctionData({
      abi: ATTESTATION_ABI,
      functionName: 'attestDecision',
      args: [
        digest,
        input.userId,
        input.agentId || 'none',
        input.actionType,
        input.decision,
        input.logId,
      ],
    });

    const tx = await CdpWalletService.sendNamedTransaction({
      walletName: getAttestationWalletName(),
      to: contractAddress,
      data,
      value: 0n,
      network: sendCheck.network as string,
    });

    logger.info('[ATTEST] Decision receipt submitted', {
      logId: input.logId,
      decision: input.decision,
      txHash: tx.transactionHash,
    });
    return tx.transactionHash;
  }

  static async attestHealthCheckpoint(input: {
    userId: string;
    agentId: string;
    intervalStartIso: string;
    intervalEndIso: string;
    eventCount: number;
    unacknowledgedAlerts: number;
    highAlerts: number;
    criticalAlerts: number;
    healthScore: number | null;
    identityCoherence: number | null;
    behavioralStability: number | null;
    interactionHealth: number | null;
    activeFlags: string[];
  }): Promise<string | null> {
    const contractAddress = getContractAddress();
    if (!contractAddress) return null;
    if (!this.isHealthCheckpointEnabled()) return null;
    const sendCheck = await shouldSendAttestation();
    if (!sendCheck.ok) {
      logger.warn('[ATTEST] Health checkpoint skipped', {
        agentId: input.agentId,
        reason: sendCheck.reason,
      });
      return null;
    }

    const digest = hashObject({
      scope: 'health_checkpoint',
      ...input,
      timestamp: new Date().toISOString(),
    });

    const healthValue = input.healthScore === null ? 'na' : String(input.healthScore);
    const decision = `score:${healthValue}|alerts:${input.unacknowledgedAlerts}|critical:${input.criticalAlerts}|events:${input.eventCount}`;
    const logId = `health:${input.agentId}:${input.intervalEndIso}`;

    const data = encodeFunctionData({
      abi: ATTESTATION_ABI,
      functionName: 'attestDecision',
      args: [digest, input.userId, input.agentId, 'health_checkpoint', decision, logId],
    });

    const tx = await CdpWalletService.sendNamedTransaction({
      walletName: getAttestationWalletName(),
      to: contractAddress,
      data,
      value: 0n,
      network: sendCheck.network as string,
    });

    logger.info('[ATTEST] Health checkpoint submitted', {
      agentId: input.agentId,
      score: input.healthScore,
      alerts: input.unacknowledgedAlerts,
      txHash: tx.transactionHash,
    });
    return tx.transactionHash;
  }
}
