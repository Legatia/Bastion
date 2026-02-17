// CDP Server Wallet v2 Integration Service
// Handles wallet provisioning, transactions, and balance queries via Coinbase Developer Platform

import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import type { Hex } from 'viem';

// CDP SDK network/token literal types
type CdpEvmNetwork = 'avalanche' | 'avalanche-fuji' | 'ethereum' | 'ethereum-sepolia';
type CdpBalanceNetwork = 'avalanche' | 'avalanche-fuji' | 'ethereum';
type CdpFaucetNetwork = 'avalanche-fuji' | 'ethereum-sepolia';
type CdpFaucetToken = 'avax' | 'eth' | 'usdc' | 'eurc' | 'cbbtc';

export class CdpWalletService {
    private static cdp: any;
    private static serverWalletAddress: string | null = null;
    private static namedWalletAddresses = new Map<string, string>();

    private static async getClient(): Promise<any> {
        if (!this.cdp) {
            if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET || !process.env.CDP_WALLET_SECRET) {
                throw new Error('CDP environment variables not configured (CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET)');
            }
            const { CdpClient } = await import('@coinbase/cdp-sdk');
            this.cdp = new CdpClient();
        }
        return this.cdp;
    }

    /**
     * Get (or create) the single Bastion server wallet used for all on-chain registrations.
     * One wallet registers all agents — simpler funding and accounting.
     */
    static async getServerWallet(): Promise<string> {
        if (this.serverWalletAddress) return this.serverWalletAddress;

        const cdp = await this.getClient();
        const account = await cdp.evm.getOrCreateAccount({ name: 'bastion-server' });
        this.serverWalletAddress = account.address;

        logger.info('[CDP] Server wallet ready', { address: account.address });
        return account.address;
    }

    /**
     * Get (or create) a named CDP wallet and cache its address.
     */
    static async getNamedWallet(name: string): Promise<string> {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new Error('Wallet name is required');
        }

        const cached = this.namedWalletAddresses.get(trimmed);
        if (cached) return cached;

        const cdp = await this.getClient();
        const account = await cdp.evm.getOrCreateAccount({ name: trimmed });
        this.namedWalletAddresses.set(trimmed, account.address);

        logger.info('[CDP] Named wallet ready', { name: trimmed, address: account.address });
        return account.address;
    }

    /**
     * Resolve the dedicated wallet used for on-chain attestations.
     */
    static async getAttestationWallet(): Promise<{ name: string; address: string }> {
        const name = process.env.ATTESTATION_WALLET_NAME || 'bastion-attestor';
        const address = await this.getNamedWallet(name);
        return { name, address };
    }

    /**
     * Send a transaction from the Bastion server wallet.
     * Used for ERC-8004 registrations — one wallet for all agents.
     */
    static async sendServerTransaction(params: {
        to: string;
        data?: Hex;
        value?: bigint;
        network: string;
    }): Promise<{ transactionHash: Hex }> {
        const cdp = await this.getClient();
        const address = await this.getServerWallet();

        const result = await cdp.evm.sendTransaction({
            address: address as `0x${string}`,
            network: params.network as CdpEvmNetwork,
            transaction: {
                to: params.to as `0x${string}`,
                data: params.data,
                value: params.value ?? 0n,
            },
        });

        logger.info('[CDP] Server tx sent', {
            txHash: result.transactionHash,
            network: params.network,
        });

        return { transactionHash: result.transactionHash as Hex };
    }

    /**
     * Send a transaction from a named CDP wallet.
     */
    static async sendNamedTransaction(params: {
        walletName: string;
        to: string;
        data?: Hex;
        value?: bigint;
        network: string;
    }): Promise<{ transactionHash: Hex }> {
        const cdp = await this.getClient();
        const address = await this.getNamedWallet(params.walletName);

        const result = await cdp.evm.sendTransaction({
            address: address as `0x${string}`,
            network: params.network as CdpEvmNetwork,
            transaction: {
                to: params.to as `0x${string}`,
                data: params.data,
                value: params.value ?? 0n,
            },
        });

        logger.info('[CDP] Named wallet tx sent', {
            walletName: params.walletName,
            txHash: result.transactionHash,
            network: params.network,
        });

        return { transactionHash: result.transactionHash as Hex };
    }

    /**
     * Provision a new CDP wallet for an agent.
     * Uses named accounts ("bastion-agent-{uuid}") for idempotent/crash-safe provisioning.
     */
    static async provisionWallet(agentId: string): Promise<string> {
        const cdp = await this.getClient();
        const accountName = `bastion-agent-${agentId}`;

        const account = await cdp.evm.getOrCreateAccount({ name: accountName });

        await prisma.agent.update({
            where: { id: agentId },
            data: {
                cdpWalletAddress: account.address,
                cdpAccountName: accountName,
            },
        });

        logger.info('[CDP] Provisioned wallet for agent', {
            agentId,
            address: account.address,
        });

        return account.address;
    }

    /**
     * Ensure an agent has a wallet — returns existing address or provisions one.
     * Lazy accessor for existing agents that were created before CDP integration.
     */
    static async ensureWallet(agentId: string): Promise<string> {
        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            select: { cdpWalletAddress: true },
        });

        if (agent?.cdpWalletAddress) {
            return agent.cdpWalletAddress;
        }

        return this.provisionWallet(agentId);
    }

    /**
     * Send a transaction from an agent's CDP wallet.
     * CDP handles gas estimation, nonce management, and signing in TEE.
     */
    static async sendTransaction(params: {
        agentId: string;
        to: string;
        data?: Hex;
        value?: bigint;
        network: string;
    }): Promise<{ transactionHash: Hex }> {
        const cdp = await this.getClient();

        const agent = await prisma.agent.findUnique({
            where: { id: params.agentId },
            select: { cdpWalletAddress: true },
        });

        if (!agent?.cdpWalletAddress) {
            throw new Error(`Agent ${params.agentId} has no CDP wallet`);
        }

        const result = await cdp.evm.sendTransaction({
            address: agent.cdpWalletAddress as `0x${string}`,
            network: params.network as CdpEvmNetwork,
            transaction: {
                to: params.to as `0x${string}`,
                data: params.data,
                value: params.value ?? 0n,
            },
        });

        logger.info('[CDP] Transaction sent', {
            agentId: params.agentId,
            txHash: result.transactionHash,
            network: params.network,
        });

        return { transactionHash: result.transactionHash as Hex };
    }

    /**
     * Get token balances for an agent's CDP wallet.
     */
    static async getBalances(agentId: string, network: string) {
        const cdp = await this.getClient();

        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            select: { cdpWalletAddress: true },
        });

        if (!agent?.cdpWalletAddress) {
            throw new Error(`Agent ${agentId} has no CDP wallet`);
        }

        const balances = await cdp.evm.listTokenBalances({
            address: agent.cdpWalletAddress as `0x${string}`,
            network: network as CdpBalanceNetwork,
        });

        return balances;
    }

    /**
     * Get token balances for an arbitrary address.
     */
    static async getAddressBalances(address: string, network: string) {
        const cdp = await this.getClient();
        return cdp.evm.listTokenBalances({
            address: address as `0x${string}`,
            network: network as CdpBalanceNetwork,
        });
    }

    /**
     * Request testnet tokens from the CDP faucet.
     * Only allows sepolia networks for safety.
     */
    static async requestFaucet(
        agentId: string,
        network: string,
        token: string = 'eth'
    ): Promise<{ transactionHash: string }> {
        if (!network.includes('sepolia') && network !== 'avalanche-fuji') {
            throw new Error('Faucet is only available on supported testnet networks (e.g. avalanche-fuji)');
        }

        const cdp = await this.getClient();

        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            select: { cdpWalletAddress: true },
        });

        if (!agent?.cdpWalletAddress) {
            throw new Error(`Agent ${agentId} has no CDP wallet`);
        }

        const result = await cdp.evm.requestFaucet({
            address: agent.cdpWalletAddress as `0x${string}`,
            network: network as CdpFaucetNetwork,
            token: token as CdpFaucetToken,
        });

        logger.info('[CDP] Faucet requested', {
            agentId,
            network,
            token,
            txHash: result.transactionHash,
        });

        return { transactionHash: result.transactionHash };
    }
}
