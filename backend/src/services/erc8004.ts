// ERC-8004 Agent Identity Service
// Handles building registration files and preparing transactions

import { PrismaClient, Agent } from '@prisma/client';

const prisma = new PrismaClient();

// Registry addresses per chain
export const IDENTITY_REGISTRIES: Record<string, { address: string; rpcUrl: string }> = {
    'base-sepolia': {
        address: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
        rpcUrl: 'https://sepolia.base.org',
    },
    'base': {
        address: '0x8004A818BFB912233c491871b3d84c89A494BD9e', // TODO: Update with mainnet address
        rpcUrl: 'https://mainnet.base.org',
    },
};

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
    }
): RegistrationFile {
    const registry = IDENTITY_REGISTRIES[options.chain];
    const chainId = options.chain === 'base-sepolia' ? '84532' : '8453';

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
        x402Support: false, // TODO: Enable when payment integration is ready
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
    };
}

/**
 * Generate the agentURI for an agent (hosted on Bastion server)
 */
export function getAgentURI(agentId: string, baseUrl: string): string {
    return `${baseUrl}/v1/agents/${agentId}/profile.json`;
}

/**
 * Build unsigned transaction data for registering an agent
 */
export function buildRegisterTxData(agentURI: string): string {
    // ERC-8004 register(string agentURI) function signature
    // function selector: keccak256("register(string)")[:4]
    const functionSelector = '0x1e59c529'; // register(string)

    // Encode the agentURI parameter
    // ABI encoding: offset (32 bytes) + length (32 bytes) + string data (padded to 32 bytes)
    const offset = '0000000000000000000000000000000000000000000000000000000000000020'; // 32 in hex
    const uriBytes = Buffer.from(agentURI, 'utf-8');
    const length = uriBytes.length.toString(16).padStart(64, '0');
    const data = uriBytes.toString('hex').padEnd(Math.ceil(uriBytes.length / 32) * 64, '0');

    return functionSelector + offset + length + data;
}

/**
 * Prepare registration transaction for frontend/CLI to sign
 */
export function prepareRegistrationTx(
    agentURI: string,
    chain: string
): {
    to: string;
    data: string;
    chainId: number;
    value: string;
} {
    const registry = IDENTITY_REGISTRIES[chain];
    if (!registry) {
        throw new Error(`Unsupported chain: ${chain}`);
    }

    const chainId = chain === 'base-sepolia' ? 84532 : 8453;

    return {
        to: registry.address,
        data: buildRegisterTxData(agentURI),
        chainId,
        value: '0', // No ETH required for registration
    };
}

/**
 * Update agent with on-chain registration details after successful tx
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
            registeredAt: new Date(),
        },
    });
}
