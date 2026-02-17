// ERC-8004 Agent Identity Service
// Handles building registration files, preparing transactions, and on-chain verification

import { Agent } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { driftDetector } from './driftDetector';
import {
    encodeFunctionData,
    decodeEventLog,
    createPublicClient,
    http,
    parseAbi,
    type Hex,
} from 'viem';
import { avalanche, avalancheFuji } from 'viem/chains';

// ERC-8004 Identity Registry ABI (minimal — register + events)
const REGISTRY_ABI = parseAbi([
    'function register(string agentURI) external returns (uint256 agentId)',
    'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);

// Registry addresses per chain
export const IDENTITY_REGISTRIES: Record<string, { address: string; rpcUrl: string }> = {
    'avalanche': {
        address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    },
    'avalanche-fuji': {
        address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    },
};

function getChainId(chain: string): string {
    switch (chain) {
        case 'avalanche':
            return '43114';
        case 'avalanche-fuji':
            return '43113';
        default:
            throw new Error(`Unsupported chain: ${chain}`);
    }
}

// ERC-8004 Registration File schema
export interface RegistrationFile {
    type: string;
    name: string;
    description: string;
    image?: string;
    services: ServiceEndpoint[];
    x402Support: boolean;
    active: boolean;
    registrations: Registration[];
    supportedTrust: string[];
    reputation?: ReputationAttestation;
}

export interface ReputationAttestation {
    protected: boolean;
    healthScore: number | null;       // 0-100, null if MoltMind not active
    identityCoherence: number | null; // 0-100
    behavioralStability: number | null; // 0-100
    interactionHealth: number | null; // 0-100
    policyLevel: 'strict' | 'standard' | 'permissive' | 'none';
    activePolicies: string[];         // Types of active policies (e.g. ['DLP', 'RATE_LIMIT'])
    uptimeDays: number;               // Days since registration without critical alerts
    lastChecked: string;              // ISO timestamp
}

export interface ServiceEndpoint {
    name: string;
    endpoint: string;
    version?: string;
}

export interface Registration {
    agentId: number;
    agentRegistry: string;
}

/**
 * Build ERC-8004 registration file from Bastion agent data
 */
export function buildRegistrationFile(
    agent: Agent,
    options: {
        baseUrl: string;
        chain: string;
        agentId?: number;
        reputation?: ReputationAttestation;
    }
): RegistrationFile {
    const registry = IDENTITY_REGISTRIES[options.chain];
    const chainId = getChainId(options.chain);

    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: agent.name,
        description: agent.description || `${agent.name} - Protected by Bastion`,
        image: `${options.baseUrl}/v1/agents/${agent.id}/avatar`,
        services: [
            {
                name: 'web',
                endpoint: `${options.baseUrl}/agents/${agent.id}`,
            },
            {
                name: 'Bastion',
                endpoint: options.baseUrl,
                version: '1.0.0',
            },
        ],
        x402Support: !!agent.cdpWalletAddress,
        active: agent.status === 'ACTIVE',
        registrations: options.agentId
            ? [
                {
                    agentId: options.agentId,
                    agentRegistry: `eip155:${chainId}:${registry.address}`,
                },
            ]
            : [],
        supportedTrust: ['reputation'],
        reputation: options.reputation,
    };
}

// Policy types that contribute to "strict" classification
const STRICT_POLICY_TYPES = ['DLP', 'BLOCKLIST', 'SPENDING_LIMIT', 'FILE_PROTECTION'];
const STANDARD_POLICY_TYPES = ['RATE_LIMIT', 'ALLOWLIST', 'TIME_WINDOW', 'PATTERN_MATCH'];

/**
 * Classify policy strictness based on active policy types and count.
 * strict:     Has DLP + at least 2 other protective policies
 * standard:   Has at least 2 active policies
 * permissive: Has 1 policy
 * none:       No policies
 */
export function classifyPolicyLevel(
    policies: { type: string; enabled: boolean }[]
): 'strict' | 'standard' | 'permissive' | 'none' {
    const active = policies.filter((p) => p.enabled);
    if (active.length === 0) return 'none';

    const hasStrict = active.some((p) => STRICT_POLICY_TYPES.includes(p.type));
    const strictCount = active.filter((p) => STRICT_POLICY_TYPES.includes(p.type)).length;

    if (hasStrict && active.length >= 3 && strictCount >= 2) return 'strict';
    if (active.length >= 2) return 'standard';
    return 'permissive';
}

/**
 * Build the full reputation attestation for an agent.
 * Queries MoltMind health score + user policies.
 */
export async function buildReputationAttestation(
    agent: Agent,
    userId: string
): Promise<ReputationAttestation> {
    // Fetch health score, policies, and user tier in parallel
    const [healthData, policies, user] = await Promise.all([
        driftDetector.getHealthScore(agent.id),
        prisma.policy.findMany({
            where: { userId, enabled: true },
            select: { type: true, enabled: true },
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        }),
    ]);

    // MoltMind health data is available for STARTER+ tiers
    const hasMoltMind = user && ['STARTER', 'PRO', 'ENTERPRISE'].includes(user.tier);

    const isProtected = true; // If this endpoint is reachable, agent is in Bastion
    const policyLevel = classifyPolicyLevel(policies);
    const activePolicies = [...new Set(policies.map((p) => p.type))];

    // Calculate uptime: days since registration (or last critical alert)
    let uptimeDays = 0;
    if (agent.registeredAt) {
        const lastCritical = await prisma.cognitiveAlert.findFirst({
            where: {
                agentId: agent.id,
                severity: 'critical',
                acknowledged: false,
            },
            orderBy: { createdAt: 'desc' },
        });

        const since = lastCritical?.createdAt || agent.registeredAt;
        uptimeDays = Math.floor((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
        protected: isProtected,
        healthScore: hasMoltMind ? (healthData?.score ?? null) : null,
        identityCoherence: hasMoltMind ? (healthData?.identityCoherence ?? null) : null,
        behavioralStability: hasMoltMind ? (healthData?.behavioralStability ?? null) : null,
        interactionHealth: hasMoltMind ? (healthData?.interactionHealth ?? null) : null,
        policyLevel,
        activePolicies,
        uptimeDays,
        lastChecked: new Date().toISOString(),
    };
}

/**
 * Generate the agentURI for an agent (hosted on Bastion server)
 */
export function getAgentURI(agentId: string, baseUrl: string): string {
    return `${baseUrl}/v1/agents/${agentId}/profile.json`;
}

/**
 * Build unsigned transaction data for registering an agent.
 * Uses viem's ABI encoder for correct encoding (replaces manual hex encoding).
 */
export function buildRegisterTxData(agentURI: string): Hex {
    return encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: 'register',
        args: [agentURI],
    });
}

/**
 * Prepare registration transaction for frontend/CLI to sign
 */
export function prepareRegistrationTx(
    agentURI: string,
    chain: string
): {
    to: string;
    data: Hex;
    chainId: number;
    value: string;
} {
    const registry = IDENTITY_REGISTRIES[chain];
    if (!registry) {
        throw new Error(`Unsupported chain: ${chain}`);
    }

    const chainId = Number(getChainId(chain));

    return {
        to: registry.address,
        data: buildRegisterTxData(agentURI),
        chainId,
        value: '0', // No ETH required for registration
    };
}

/**
 * Verify a registration transaction on-chain.
 * Fetches the tx receipt, checks it targeted the correct registry,
 * and parses the Registered event to extract agentId and owner.
 */
export async function verifyRegistrationTx(
    txHash: Hex,
    chain: string,
    expectedAgentURI: string
): Promise<{ agentId: string; ownerAddress: string }> {
    const registry = IDENTITY_REGISTRIES[chain];
    if (!registry) {
        throw new Error(`Unsupported chain: ${chain}`);
    }

    const viemChain = chain === 'avalanche'
        ? avalanche
        : avalancheFuji;
    const client = createPublicClient({
        chain: viemChain,
        transport: http(registry.rpcUrl),
    });

    let receipt;
    try {
        receipt = await client.getTransactionReceipt({ hash: txHash });
    } catch (rpcError: any) {
        // viem throws if the tx is not found (not yet mined or invalid hash)
        if (rpcError.message?.includes('could not be found') || rpcError.message?.includes('not found')) {
            throw new Error(
                'Transaction not yet confirmed on-chain. Please wait for the transaction to be mined and try again.'
            );
        }
        throw new Error(`Failed to fetch transaction: ${rpcError.message}`);
    }

    if (receipt.status !== 'success') {
        throw new Error('Transaction reverted on-chain');
    }

    // Verify tx was sent to the correct registry contract
    if (receipt.to?.toLowerCase() !== registry.address.toLowerCase()) {
        throw new Error(
            `Transaction target ${receipt.to} does not match registry ${registry.address}`
        );
    }

    // Parse logs for the Registered event
    for (const log of receipt.logs) {
        // Only look at logs from the registry contract
        if (log.address.toLowerCase() !== registry.address.toLowerCase()) continue;

        try {
            const decoded = decodeEventLog({
                abi: REGISTRY_ABI,
                data: log.data,
                topics: log.topics,
            });

            if (decoded.eventName === 'Registered') {
                const args = decoded.args as {
                    agentId: bigint;
                    agentURI: string;
                    owner: `0x${string}`;
                };

                // Verify the agentURI in the event matches this agent
                if (args.agentURI !== expectedAgentURI) {
                    throw new Error(
                        `agentURI mismatch: tx registered "${args.agentURI}" but expected "${expectedAgentURI}"`
                    );
                }

                return {
                    agentId: args.agentId.toString(),
                    ownerAddress: args.owner,
                };
            }
        } catch (e: any) {
            // If it's our own thrown error, re-throw
            if (e.message?.includes('mismatch') || e.message?.includes('does not match')) {
                throw e;
            }
            // Otherwise it's a decode error for a different event — skip
        }
    }

    throw new Error('No Registered event found in transaction logs');
}

/**
 * Update agent with verified on-chain registration details.
 * Only called after verifyRegistrationTx succeeds.
 */
export async function recordRegistration(
    agentId: string,
    params: {
        onchainId: string;
        registryChain: string;
        ownerAddress: string;
        txHash: string;
    }
): Promise<Agent> {
    const registry = IDENTITY_REGISTRIES[params.registryChain];
    const baseUrl = process.env.BACKEND_URL || 'https://bastion-gamma.vercel.app';

    return prisma.agent.update({
        where: { id: agentId },
        data: {
            onchainId: params.onchainId,
            registryChain: params.registryChain,
            registryAddress: registry.address,
            agentURI: getAgentURI(agentId, baseUrl),
            ownerAddress: params.ownerAddress,
            registrationTxHash: params.txHash,
            registeredAt: new Date(),
        },
    });
}
