import { Router, Request, Response } from 'express';
import { SubscriptionTier } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { StripeService } from '../services/stripe-service';
import { QuotaService } from '../services/quota-service';
import { logger } from '../middleware/logger';
import Stripe from 'stripe';

const router = Router();

/**
 * POST /v1/webhooks/stripe
 * Handle Stripe webhook events for tier-based billing
 */
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
    let event: Stripe.Event;

    try {
        const signature = req.headers['stripe-signature'] as string;
        event = StripeService.constructEvent(req.body, signature);
    } catch (err: any) {
        logger.warn('[STRIPE] Webhook signature verification failed:', { error: err.message });
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotency: skip already-processed events
    const existing = await prisma.webhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing) {
        logger.info('[STRIPE] Duplicate webhook event skipped', { eventId: event.id, type: event.type });
        return res.json({ received: true, duplicate: true });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }
            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                logger.info('[STRIPE] Invoice paid', { invoiceId: invoice.id });
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionDeleted(subscription);
                break;
            }
            default:
                break;
        }

        // Record processed event for idempotency
        await prisma.webhookEvent.create({
            data: { eventId: event.id, type: event.type },
        });

        res.json({ received: true });
    } catch (error: any) {
        logger.error('[STRIPE] Webhook processing failed:', { error: error.message, eventType: event.type });
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Resolve tier from a Stripe subscription's price ID
 */
function resolveTierFromPriceId(priceId: string): SubscriptionTier | null {
    if (priceId === process.env.STRIPE_PRICE_ID_STARTER) return 'STARTER';
    if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'PRO';
    return null;
}

/**
 * Resolve tier from a Stripe subscription object by scanning its items
 */
function resolveTierFromSubscription(subscription: Stripe.Subscription): SubscriptionTier | null {
    for (const item of subscription.items.data) {
        const priceId = typeof item.price === 'string' ? item.price : item.price.id;
        const tier = resolveTierFromPriceId(priceId);
        if (tier) return tier;
    }
    return null;
}

/**
 * Handle successful checkout.
 * Sets user.tier from session metadata and handles OpenClaw one-time purchases.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.client_reference_id;
    if (!userId) {
        logger.warn('[STRIPE] Checkout completed but no userId found in client_reference_id');
        return;
    }

    logger.info('[STRIPE] Processing checkout completion', { userId, sessionId: session.id });

    // Set tier from metadata
    const targetTier = session.metadata?.targetTier as SubscriptionTier | undefined;
    const updateData: any = {};

    if (targetTier && ['STARTER', 'PRO', 'ENTERPRISE'].includes(targetTier)) {
        updateData.tier = targetTier;
    }

    // Link subscription ID
    if (session.subscription) {
        const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        updateData.stripeSubscriptionId = subscriptionId;
    }

    // Ensure stripeCustomerId is stored
    if (session.customer) {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
        updateData.stripeCustomerId = customerId;
    }

    // Check for OpenClaw via metadata on the checkout session
    if (session.metadata?.includeOpenclaw === 'true') {
        updateData.openclawPurchased = true;
        logger.info('[STRIPE] OpenClaw activated via metadata', { userId });
    }

    // Fallback: check line items for OpenClaw price ID
    if (!updateData.openclawPurchased && process.env.STRIPE_PRICE_ID_OPENCLAW) {
        try {
            const stripe = StripeService.getClient();
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                expand: ['data.price'],
            });

            for (const item of lineItems.data) {
                const itemPriceId = (item.price as Stripe.Price)?.id;
                if (itemPriceId === process.env.STRIPE_PRICE_ID_OPENCLAW) {
                    updateData.openclawPurchased = true;
                    logger.info('[STRIPE] OpenClaw activated via price ID match', { userId });
                }
            }
        } catch (err: any) {
            logger.warn('[STRIPE] Could not check line items for OpenClaw:', { error: err.message });
        }
    }

    // Apply all updates
    if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
    }

    QuotaService.invalidateFeatureCache(userId);
    logger.info('[STRIPE] Checkout processed', { userId, tier: targetTier, hasSubscription: !!session.subscription });
}

/**
 * Handle subscription updates.
 * Always resolve the current tier from the subscription's price IDs.
 * If no longer active → downgrade to FREE.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });

    if (!user) {
        logger.warn('[STRIPE] Subscription updated for unknown customer', { customerId });
        return;
    }

    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    if (!isActive) {
        // Downgrade to FREE
        await prisma.user.update({
            where: { id: user.id },
            data: { tier: 'FREE', stripeSubscriptionId: null },
        });
        QuotaService.invalidateFeatureCache(user.id);
        logger.info('[STRIPE] Subscription no longer active, downgraded to FREE', {
            userId: user.id,
            subscriptionId: subscription.id,
            status: subscription.status,
        });
        return;
    }

    // Active subscription — always resolve tier from price IDs to catch
    // upgrades (STARTER→PRO) and downgrades (PRO→STARTER) via Stripe portal
    const resolvedTier = resolveTierFromSubscription(subscription);

    if (resolvedTier && resolvedTier !== user.tier) {
        await prisma.user.update({
            where: { id: user.id },
            data: { tier: resolvedTier, stripeSubscriptionId: subscription.id },
        });
        QuotaService.invalidateFeatureCache(user.id);
        logger.info('[STRIPE] Subscription tier changed', {
            userId: user.id,
            previousTier: user.tier,
            newTier: resolvedTier,
            status: subscription.status,
        });
    } else {
        logger.info('[STRIPE] Subscription synced, tier unchanged', {
            userId: user.id,
            tier: user.tier,
            status: subscription.status,
        });
    }
}

/**
 * Handle subscription cancellation — downgrade to FREE
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });

    if (!user) return;

    await prisma.user.update({
        where: { id: user.id },
        data: { tier: 'FREE', stripeSubscriptionId: null },
    });

    QuotaService.invalidateFeatureCache(user.id);
    logger.info('[STRIPE] Subscription deleted - downgraded to FREE', {
        userId: user.id,
        subscriptionId: subscription.id,
    });
}

export default router;
