// Agent Identity Routes (ERC-8004)
// Endpoints for on-chain agent verification

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateApiKey } from '../middleware/auth';
import {
    buildRegistrationFile,
    prepareRegistrationTx,
    recordRegistration,
    getAgentURI,
    IDENTITY_REGISTRIES,
} from '../services/erc8004';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /v1/agents/:id/profile.json
 * Public endpoint serving the ERC-8004 registration file
 */
router.get('/agents/:id/profile.json', async (req: Request, res: Response) => {
    try {
        const agent = await prisma.agent.findUnique({
            where: { id: req.params.id as string },
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const baseUrl = process.env.BACKEND_URL || 'https://bastion-gamma.vercel.app';
        const registrationFile = buildRegistrationFile(agent, {
            baseUrl,
            chain: agent.registryChain || 'base-sepolia',
            agentId: agent.onchainId ? parseInt(agent.onchainId) : undefined,
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Public endpoint
        res.json(registrationFile);
    } catch (error) {
        console.error('Error fetching agent profile:', error);
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
                    registeredAt: agent.registeredAt,
                }
                : null,
            profileUrl: getAgentURI(agent.id, baseUrl),
        });
    } catch (error) {
        console.error('Error fetching identity:', error);
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

        const { chain = 'base-sepolia' } = req.body;

        if (!IDENTITY_REGISTRIES[chain]) {
            return res.status(400).json({
                error: 'Invalid chain',
                message: `Supported chains: ${Object.keys(IDENTITY_REGISTRIES).join(', ')}`,
            });
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
        console.error('Error preparing verification:', error);
        res.status(500).json({ error: 'Failed to prepare verification' });
    }
});

/**
 * POST /v1/agents/:id/verify/confirm
 * Confirm successful on-chain registration
 */
router.post('/agents/:id/verify/confirm', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { onchainId, registryChain, ownerAddress, txHash } = req.body;

        if (!onchainId || !registryChain || !ownerAddress || !txHash) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['onchainId', 'registryChain', 'ownerAddress', 'txHash'],
            });
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

        const updatedAgent = await recordRegistration(agent.id, {
            onchainId,
            registryChain,
            ownerAddress,
            txHash,
        });

        res.json({
            message: 'Agent verified successfully!',
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
        console.error('Error confirming verification:', error);
        res.status(500).json({ error: 'Failed to confirm verification' });
    }
});

export default router;
