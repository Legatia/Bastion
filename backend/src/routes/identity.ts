// Agent Identity Routes (ERC-8004)
// Endpoints for on-chain agent verification

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateApiKey } from '../middleware/auth';
import { QuotaService } from '../services/quota-service';
import { logger } from '../middleware/logger';
import {
    buildRegistrationFile,
    buildReputationAttestation,
    verifyRegistrationTx,
    prepareRegistrationTx,
    recordRegistration,
    getAgentURI,
    IDENTITY_REGISTRIES,
} from '../services/erc8004';
import { CdpWalletService } from '../services/cdp-wallet-service';
import rateLimit from 'express-rate-limit';
import { createPublicClient, http, type Hex } from 'viem';
import { avalanche, avalancheFuji, baseSepolia, base } from 'viem/chains';

const router = Router();
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
const NETWORK_RPC_FALLBACKS: Record<string, string> = {
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    'avalanche-fuji': 'https://api.avax-test.network/ext/bc/C/rpc',
    base: 'https://mainnet.base.org',
    'base-sepolia': 'https://sepolia.base.org',
};

// Rate limit for the public profile.json endpoint (P2-7)
const profileLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * GET /v1/agents/:id/profile.json
 * Public endpoint serving the ERC-8004 registration file
 */
router.get('/agents/:id/profile.json', profileLimiter, async (req: Request, res: Response) => {
    try {
        const agent = await prisma.agent.findUnique({
            where: { id: req.params.id as string },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const baseUrl = process.env.BACKEND_URL || 'https://bastion-gamma.vercel.app';

        // Build live reputation attestation
        const reputation = await buildReputationAttestation(agent, agent.userId);

        const registrationFile = buildRegistrationFile(agent, {
            baseUrl,
            chain: agent.registryChain || 'avalanche',
            agentId: agent.onchainId ? parseInt(agent.onchainId) : undefined,
            reputation,
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Public endpoint
        res.setHeader('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
        res.json(registrationFile);
    } catch (error) {
        logger.error('Error fetching agent profile:', error);
        res.status(500).json({ error: 'Failed to fetch agent profile' });
    }
});

/**
 * GET /v1/agents/:id/identity
 * Get on-chain identity status for an agent
 */
router.get('/agents/:id/identity', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const agent = await prisma.agent.findFirst({
            where: {
                id: req.params.id as string,
                userId: req.user.id,
            },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const isVerified = !!agent.onchainId;
        const baseUrl = process.env.BACKEND_URL || 'https://bastion-gamma.vercel.app';

        res.json({
            verified: isVerified,
            identity: isVerified
                ? {
                    onchainId: agent.onchainId,
                    registryChain: agent.registryChain,
                    registryAddress: agent.registryAddress,
                    agentURI: agent.agentURI,
                    ownerAddress: agent.ownerAddress,
                    registrationTxHash: agent.registrationTxHash,
                    registeredAt: agent.registeredAt,
                }
                : null,
            wallet: agent.cdpWalletAddress
                ? { address: agent.cdpWalletAddress }
                : null,
            profileUrl: getAgentURI(agent.id, baseUrl),
        });
    } catch (error) {
        logger.error('Error fetching identity:', error);
        res.status(500).json({ error: 'Failed to fetch identity status' });
    }
});

/**
 * POST /v1/agents/:id/verify
 * Prepare verification transaction for signing
 */
router.post('/agents/:id/verify', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const agentId = req.params.id as string;
        const { chain = 'avalanche' } = req.body;

        // Check ERC-8004 tier access (STARTER+)
        const access = await QuotaService.checkFeatureAccess(req.user.id, 'ERC8004_DAILY');
        if (!access.allowed) {
            return res.status(403).json({
                allowed: false,
                error: 'UPGRADE_REQUIRED',
                reason: access.message,
            });
        }

        if (!IDENTITY_REGISTRIES[chain]) {
            return res.status(400).json({
                error: 'Invalid chain',
                message: `Supported chains: ${Object.keys(IDENTITY_REGISTRIES).join(', ')}`,
            });
        }

        const agent = await prisma.agent.findFirst({
            where: { id: agentId, userId: req.user.id },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.onchainId) {
            return res.status(400).json({
                error: 'Already verified',
                message: 'This agent is already verified on-chain',
                identity: {
                    onchainId: agent.onchainId,
                    registryChain: agent.registryChain,
                },
            });
        }

        const baseUrl = process.env.BACKEND_URL || 'https://bastion-gamma.vercel.app';
        const agentURI = getAgentURI(agent.id, baseUrl);
        const tx = prepareRegistrationTx(agentURI, chain);

        res.json({
            message: 'Sign this transaction to verify your agent on-chain',
            transaction: tx,
            agentURI,
            registryAddress: IDENTITY_REGISTRIES[chain].address,
        });
    } catch (error) {
        logger.error('Error preparing verification:', error);
        res.status(500).json({ error: 'Failed to prepare verification' });
    }
});

/**
 * POST /v1/agents/:id/verify/confirm
 * Confirm on-chain registration by providing the txHash.
 * The backend verifies the tx on-chain — no client-supplied onchainId/ownerAddress trusted.
 */
router.post('/agents/:id/verify/confirm', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const agentId = req.params.id as string;
        const { txHash, registryChain = 'avalanche' } = req.body;

        if (!txHash) {
            return res.status(400).json({
                error: 'Missing required field: txHash',
            });
        }

        if (!IDENTITY_REGISTRIES[registryChain]) {
            return res.status(400).json({
                error: 'Invalid registryChain',
                message: `Supported chains: ${Object.keys(IDENTITY_REGISTRIES).join(', ')}`,
            });
        }

        // Check ERC-8004 tier access (STARTER+)
        const access = await QuotaService.checkFeatureAccess(req.user.id, 'ERC8004_DAILY');
        if (!access.allowed) {
            return res.status(403).json({
                allowed: false,
                error: 'UPGRADE_REQUIRED',
                reason: access.message,
            });
        }

        const agent = await prisma.agent.findFirst({
            where: { id: agentId, userId: req.user.id },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.onchainId) {
            return res.status(400).json({
                error: 'Already verified',
                message: 'This agent is already verified on-chain',
            });
        }

        // P0-2: Verify the transaction on-chain instead of trusting the client
        const baseUrl = process.env.BACKEND_URL || 'https://bastion-gamma.vercel.app';
        const expectedAgentURI = getAgentURI(agent.id, baseUrl);

        let verified;
        try {
            verified = await verifyRegistrationTx(
                txHash as Hex,
                registryChain,
                expectedAgentURI
            );
        } catch (verifyError: any) {
            return res.status(400).json({
                error: 'On-chain verification failed',
                message: verifyError.message,
            });
        }

        // All checks passed — record with data extracted from the chain
        const updatedAgent = await recordRegistration(agent.id, {
            onchainId: verified.agentId,
            registryChain,
            ownerAddress: verified.ownerAddress,
            txHash,
        });

        res.json({
            message: 'Agent verified on-chain!',
            agent: {
                id: updatedAgent.id,
                name: updatedAgent.name,
                verified: true,
                onchainId: updatedAgent.onchainId,
                registryChain: updatedAgent.registryChain,
                ownerAddress: updatedAgent.ownerAddress,
            },
        });
    } catch (error) {
        logger.error('Error confirming verification:', error);
        res.status(500).json({ error: 'Failed to confirm verification' });
    }
});

/**
 * POST /v1/agents/:id/register
 * Server-side ERC-8004 registration using a single Bastion server wallet.
 * No user wallet needed — server wallet signs, broadcasts, and pays gas.
 */
router.post('/agents/:id/register', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const agentId = req.params.id as string;
        const { chain = 'avalanche' } = req.body;

        // Check ERC-8004 tier access (STARTER+)
        const access = await QuotaService.checkFeatureAccess(req.user.id, 'ERC8004_DAILY');
        if (!access.allowed) {
            return res.status(403).json({
                allowed: false,
                error: 'UPGRADE_REQUIRED',
                reason: access.message,
            });
        }

        if (!IDENTITY_REGISTRIES[chain]) {
            return res.status(400).json({
                error: 'Invalid chain',
                message: `Supported chains: ${Object.keys(IDENTITY_REGISTRIES).join(', ')}`,
            });
        }

        const agent = await prisma.agent.findFirst({
            where: { id: agentId, userId: req.user.id },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.onchainId) {
            return res.status(400).json({
                error: 'Already registered',
                message: 'This agent is already registered on-chain',
                identity: {
                    onchainId: agent.onchainId,
                    registryChain: agent.registryChain,
                },
            });
        }

        // Prepare registration calldata
        const baseUrl = process.env.BACKEND_URL || 'https://bastion-gamma.vercel.app';
        const agentURI = getAgentURI(agent.id, baseUrl);
        const tx = prepareRegistrationTx(agentURI, chain);

        // Send via single Bastion server wallet (pays gas, visible traction on explorer)
        const { transactionHash } = await CdpWalletService.sendServerTransaction({
            to: tx.to,
            data: tx.data,
            value: 0n,
            network: chain,
        });

        // Wait for mining
        const registry = IDENTITY_REGISTRIES[chain];
        const viemChain = chain === 'avalanche'
            ? avalanche
            : chain === 'avalanche-fuji'
                ? avalancheFuji
                : chain === 'base-sepolia'
                    ? baseSepolia
                    : base;
        const publicClient = createPublicClient({
            chain: viemChain,
            transport: http(registry.rpcUrl),
        });

        await publicClient.waitForTransactionReceipt({ hash: transactionHash });

        // Verify on-chain
        const verified = await verifyRegistrationTx(transactionHash, chain, agentURI);

        // Record in DB
        const updatedAgent = await recordRegistration(agent.id, {
            onchainId: verified.agentId,
            registryChain: chain,
            ownerAddress: verified.ownerAddress,
            txHash: transactionHash,
        });

        res.json({
            message: 'Agent registered on-chain!',
            agent: {
                id: updatedAgent.id,
                name: updatedAgent.name,
                verified: true,
                onchainId: updatedAgent.onchainId,
                registryChain: updatedAgent.registryChain,
                ownerAddress: updatedAgent.ownerAddress,
            },
        });
    } catch (error: any) {
        logger.error('Error in server-side registration:', error);
        res.status(500).json({ error: 'Registration failed', message: error.message });
    }
});

/**
 * GET /v1/attest/wallet
 * Public endpoint exposing the dedicated attestation wallet address for funding/monitoring.
 */
router.get('/attest/wallet', async (req: Request, res: Response) => {
    try {
        const network = process.env.ATTESTATION_NETWORK || 'avalanche';
        const wallet = await CdpWalletService.getAttestationWallet();

        let balances: any = [];
        try {
            balances = await CdpWalletService.getAddressBalances(wallet.address, network);
        } catch {
            // Non-blocking: wallet address is still useful for funding.
        }

        const explorerBase = network === 'avalanche'
            ? 'https://snowtrace.io'
            : network === 'avalanche-fuji'
                ? 'https://testnet.snowtrace.io'
                : network === 'base'
                    ? 'https://basescan.org'
                    : 'https://sepolia.basescan.org';

        res.json({
            walletName: wallet.name,
            network,
            address: wallet.address,
            explorerUrl: `${explorerBase}/address/${wallet.address}`,
            balances,
        });
    } catch (error: any) {
        logger.error('Error fetching attestation wallet:', error);
        res.status(500).json({ error: 'Failed to fetch attestation wallet', message: error.message });
    }
});

/**
 * GET /v1/attest/status
 * Public attestation health/configuration endpoint.
 */
router.get('/attest/status', async (_req: Request, res: Response) => {
    try {
        const network = process.env.ATTESTATION_NETWORK || 'avalanche';
        const walletName = process.env.ATTESTATION_WALLET_NAME || 'bastion-attestor';
        const contractAddress = process.env.ATTESTATION_CONTRACT_ADDRESS || null;
        const rpcUrl = process.env.ATTESTATION_RPC_URL || NETWORK_RPC_FALLBACKS[network] || null;
        const cdpNetworkSupported = CDP_SUPPORTED_EVM_NETWORKS.has(network);

        const wallet = await CdpWalletService.getAttestationWallet();

        let balances: any = [];
        try {
            balances = await CdpWalletService.getAddressBalances(wallet.address, network);
        } catch {
            // Non-blocking for status endpoint.
        }

        let contractCodePresent: boolean | null = null;
        let contractCodeCheckError: string | null = null;
        if (contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress) && rpcUrl) {
            try {
                const client = createPublicClient({ transport: http(rpcUrl) });
                const bytecode = await client.getBytecode({ address: contractAddress as `0x${string}` });
                contractCodePresent = !!bytecode && bytecode !== '0x';
            } catch (error: any) {
                contractCodeCheckError = error?.message || 'Failed to fetch contract bytecode';
            }
        }

        let lastErrorHint: string | null = null;
        if (!contractAddress) {
            lastErrorHint = 'ATTESTATION_CONTRACT_ADDRESS is not set';
        } else if (!cdpNetworkSupported) {
            lastErrorHint = `ATTESTATION_NETWORK "${network}" is not supported by CDP sendTransaction`;
        } else if (contractCodePresent === false) {
            lastErrorHint = `No bytecode found at ${contractAddress} on ${network}`;
        } else if (contractCodeCheckError) {
            lastErrorHint = contractCodeCheckError;
        } else if (!balances || balances.length === 0) {
            lastErrorHint = 'Attestation wallet appears unfunded on configured network';
        }

        const enabled = !!contractAddress && cdpNetworkSupported;

        res.json({
            enabled,
            cdpNetworkSupported,
            network,
            rpcUrl,
            walletName,
            walletAddress: wallet.address,
            walletBalances: balances,
            contractAddress,
            contractCodePresent,
            contractCodeCheckError,
            lastErrorHint,
        });
    } catch (error: any) {
        logger.error('Error fetching attestation status:', error);
        res.status(500).json({ error: 'Failed to fetch attestation status', message: error.message });
    }
});

/**
 * GET /v1/agents/:id/wallet
 * Get agent's CDP wallet address, balances, and explorer link.
 */
router.get('/agents/:id/wallet', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const agent = await prisma.agent.findFirst({
            where: {
                id: req.params.id as string,
                userId: req.user.id,
            },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Check CDP_WALLET tier access (STARTER+)
        const walletAccess = await QuotaService.checkFeatureAccess(req.user.id, 'CDP_WALLET');
        if (!walletAccess.allowed) {
            return res.status(403).json({
                allowed: false,
                error: 'UPGRADE_REQUIRED',
                reason: walletAccess.message,
            });
        }

        if (!agent.cdpWalletAddress) {
            return res.status(404).json({
                error: 'No wallet',
                message: 'This agent does not have a CDP wallet yet.',
            });
        }

        const network = (req.query.network as string) || 'avalanche';

        let balances;
        try {
            balances = await CdpWalletService.getBalances(agent.id, network);
        } catch {
            balances = [];
        }

        const explorerBase =
            network === 'avalanche'
                ? 'https://snowtrace.io'
                : network === 'avalanche-fuji'
                    ? 'https://testnet.snowtrace.io'
                    : network === 'base'
                        ? 'https://basescan.org'
                        : 'https://sepolia.basescan.org';

        res.json({
            address: agent.cdpWalletAddress,
            network,
            explorerUrl: `${explorerBase}/address/${agent.cdpWalletAddress}`,
            balances,
        });
    } catch (error) {
        logger.error('Error fetching wallet:', error);
        res.status(500).json({ error: 'Failed to fetch wallet info' });
    }
});

/**
 * POST /v1/agents/:id/wallet/faucet
 * Request testnet tokens for the agent's CDP wallet.
 */
router.post('/agents/:id/wallet/faucet', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const agent = await prisma.agent.findFirst({
            where: {
                id: req.params.id as string,
                userId: req.user.id,
            },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Check CDP_WALLET tier access (STARTER+)
        const walletAccess = await QuotaService.checkFeatureAccess(req.user.id, 'CDP_WALLET');
        if (!walletAccess.allowed) {
            return res.status(403).json({
                allowed: false,
                error: 'UPGRADE_REQUIRED',
                reason: walletAccess.message,
            });
        }

        const { network = 'avalanche-fuji', token = 'avax' } = req.body;

        if (!network.includes('sepolia') && network !== 'avalanche-fuji') {
            return res.status(400).json({
                error: 'Faucet only available on testnet networks',
            });
        }

        // Ensure wallet exists
        await CdpWalletService.ensureWallet(agent.id);

        const result = await CdpWalletService.requestFaucet(agent.id, network, token);

        res.json({
            message: `Faucet ${token} requested on ${network}`,
            transactionHash: result.transactionHash,
            explorerUrl: network === 'avalanche-fuji'
                ? `https://testnet.snowtrace.io/tx/${result.transactionHash}`
                : `https://sepolia.basescan.org/tx/${result.transactionHash}`,
        });
    } catch (error: any) {
        logger.error('Error requesting faucet:', error);
        res.status(500).json({ error: 'Faucet request failed', message: error.message });
    }
});

export default router;
