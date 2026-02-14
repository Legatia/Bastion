// Module/Tier Management Routes - Tier checkout, pricing, portal

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateApiKey } from '../middleware/auth';
import { QuotaService, TIER_CONFIG, TierFeature } from '../services/quota-service';
import { StripeService } from '../services/stripe-service';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * GET /v1/modules
 * Return current tier status and available features
 */
router.get('/modules', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { tier: true, openclawPurchased: true, stripeSubscriptionId: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const config = TIER_CONFIG[user.tier];

        res.json({
            tier: user.tier,
            openclawPurchased: user.openclawPurchased,
            hasSubscription: !!user.stripeSubscriptionId,
            features: config.features,
            limits: {
                maxAgents: config.maxAgents === Infinity ? -1 : config.maxAgents,
                maxDailyChecks: config.maxDailyChecks === Infinity ? -1 : config.maxDailyChecks,
            },
        });
    } catch (error: any) {
        logger.error('[MODULES] Error getting tier status:', { error: error.message });
        res.status(500).json({ error: 'Failed to get tier status' });
    }
});

/**
 * GET /v1/modules/pricing
 * Return tier pricing table for frontend
 */
router.get('/modules/pricing', async (_req: Request, res: Response) => {
    res.json({
        tiers: [
            {
                tier: 'FREE',
                price: 0,
                priceDisplay: '$0',
                label: 'Free',
                maxAgents: TIER_CONFIG.FREE.maxAgents,
                maxDailyChecks: TIER_CONFIG.FREE.maxDailyChecks,
                features: TIER_CONFIG.FREE.features,
            },
            {
                tier: 'STARTER',
                price: 2900,
                priceDisplay: '$29/mo',
                label: 'Starter',
                maxAgents: TIER_CONFIG.STARTER.maxAgents,
                maxDailyChecks: TIER_CONFIG.STARTER.maxDailyChecks,
                features: TIER_CONFIG.STARTER.features,
            },
            {
                tier: 'PRO',
                price: 7900,
                priceDisplay: '$79/mo',
                label: 'Pro',
                maxAgents: TIER_CONFIG.PRO.maxAgents,
                maxDailyChecks: TIER_CONFIG.PRO.maxDailyChecks === Infinity ? -1 : TIER_CONFIG.PRO.maxDailyChecks,
                features: TIER_CONFIG.PRO.features,
            },
            {
                tier: 'ENTERPRISE',
                price: 0,
                priceDisplay: 'Custom',
                label: 'Enterprise',
                maxAgents: -1,
                maxDailyChecks: -1,
                features: TIER_CONFIG.ENTERPRISE.features,
            },
        ],
        addons: [
            {
                id: 'AGENT_RUNTIME',
                name: 'Agent Runtime Manager',
                price: 9900,
                priceDisplay: '$99',
                model: 'one_time',
            },
        ],
    });
});

/**
 * POST /v1/modules/checkout
 * Create a Stripe Checkout Session for tier subscription (+ optional agent runtime add-on)
 */
router.post('/modules/checkout', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const userEmail = req.user!.email;
        const { tier, includeOpenclaw } = req.body;

        if (!tier || !['STARTER', 'PRO'].includes(tier)) {
            return res.status(400).json({
                error: 'Invalid tier',
                message: 'tier must be STARTER or PRO',
            });
        }

        // Get the right Stripe Price ID from env
        const priceId = tier === 'STARTER'
            ? process.env.STRIPE_PRICE_ID_STARTER
            : process.env.STRIPE_PRICE_ID_PRO;

        if (!priceId) {
            return res.status(500).json({
                error: 'Configuration error',
                message: `STRIPE_PRICE_ID_${tier} not configured`,
            });
        }

        // Get or create Stripe customer
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { stripeCustomerId: true, stripeSubscriptionId: true, tier: true, name: true },
        });

        // Prevent duplicate subscriptions — if user already has an active subscription,
        // they should use the Stripe Customer Portal to change plans
        if (user?.stripeSubscriptionId) {
            return res.status(409).json({
                error: 'EXISTING_SUBSCRIPTION',
                message: 'You already have an active subscription. Use the customer portal to change plans.',
                currentTier: user.tier,
            });
        }

        const customerId = await StripeService.getOrCreateCustomer(userEmail, user?.name || undefined);

        if (!user?.stripeCustomerId) {
            await prisma.user.update({
                where: { id: userId },
                data: { stripeCustomerId: customerId },
            });
        }

        // Build line items
        const lineItems: any[] = [
            { price: priceId, quantity: 1 },
        ];

        // Optionally include Agent Runtime one-time (charged once on first invoice)
        if (includeOpenclaw) {
            const openclawPriceId = process.env.STRIPE_PRICE_ID_OPENCLAW;
            if (openclawPriceId) {
                lineItems.push({ price: openclawPriceId, quantity: 1 });
            }
        }

        // Build metadata — include runtime add-on flag so webhook can detect it
        const metadata: Record<string, string> = { targetTier: tier };
        if (includeOpenclaw) {
            metadata.includeOpenclaw = 'true';
        }

        const session = await StripeService.createCheckoutSession({
            customerId,
            lineItems,
            returnUrl: `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            clientReferenceId: userId,
            metadata,
            mode: 'subscription',
        });

        res.json({ clientSecret: session.clientSecret, sessionId: session.sessionId });
    } catch (error: any) {
        logger.error('[STRIPE] Checkout error:', { error: error.message });
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

/**
 * POST /v1/modules/portal
 * Create a Stripe Customer Portal session
 */
router.post('/modules/portal', authenticateApiKey, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user?.stripeCustomerId) {
            return res.status(404).json({ error: 'No billing account found' });
        }

        const url = await StripeService.createPortalSession(
            user.stripeCustomerId,
            `${process.env.FRONTEND_URL}/billing`
        );

        res.json({ url });
    } catch (error: any) {
        logger.error('[STRIPE] Portal error:', { error: error.message });
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

/**
 * POST /v1/modules/checkout/debug
 * Debug endpoint to bypass payment and set tier directly.
 * Only works in development or test mode.
 */
router.post('/modules/checkout/debug', authenticateApiKey, async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
        return res.status(403).json({ error: 'Debug endpoint only available in development' });
    }

    try {
        const userId = req.user!.id;
        const { tier, includeOpenclaw } = req.body;

        if (!tier || !['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].includes(tier)) {
            return res.status(400).json({
                error: 'Invalid tier',
                message: 'tier must be FREE, STARTER, PRO, or ENTERPRISE',
            });
        }

        const updateData: any = { tier };

        if (includeOpenclaw) {
            updateData.openclawPurchased = true;
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        QuotaService.invalidateFeatureCache(userId);
        logger.info('[DEBUG] Tier updated', { userId, tier, includeOpenclaw });
        res.json({ success: true, tier });
    } catch (error: any) {
        logger.error('[DEBUG] Tier update error:', { error: error.message });
        res.status(500).json({ error: 'Failed to update tier' });
    }
});

export default router;
