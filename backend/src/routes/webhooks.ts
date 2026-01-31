import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CouponManager } from '../services/coupon-manager';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.POLAR_WEBHOOK_SECRET;

    if (!secret) {
        console.error('[SECURITY] POLAR_WEBHOOK_SECRET not configured!');
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

/**
 * POST /v1/webhooks/polar
 * Handle subscription events from Polar.sh
 *
 * Security:
 * - Signature verification (HMAC-SHA256)
 * - Idempotency (prevent duplicate processing)
 * - Timestamp validation (reject old events)
 */
router.post('/webhooks/polar', async (req: Request, res: Response) => {
    try {
        // 1. Verify webhook signature
        const signature = req.headers['polar-webhook-signature'] as string;
        const payload = JSON.stringify(req.body);

        if (!signature) {
            console.warn('[SECURITY] Webhook received without signature');
            return res.status(401).json({ error: 'Missing webhook signature' });
        }

        if (!verifyWebhookSignature(payload, signature)) {
            console.warn('[SECURITY] Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body;

        // 2. Validate event structure
        if (!event.id || !event.type) {
            console.warn('[WEBHOOK] Malformed event - missing id or type');
            return res.status(400).json({ error: 'Invalid event format' });
        }

        // 3. Check idempotency (prevent duplicate processing)
        const existingEvent = await prisma.webhookEvent.findUnique({
            where: { eventId: event.id }
        });

        if (existingEvent) {
            console.log(`[WEBHOOK] Duplicate event ${event.id} ignored (already processed)`);
            return res.json({ received: true, duplicate: true });
        }

        // 4. Validate timestamp (reject events older than 5 minutes)
        if (event.timestamp) {
            const eventTime = new Date(event.timestamp).getTime();
            const now = Date.now();
            const ageMs = now - eventTime;

            if (ageMs > 5 * 60 * 1000) {
                console.warn(`[WEBHOOK] Event ${event.id} too old (${ageMs}ms)`);
                return res.status(400).json({ error: 'Event expired' });
            }
        }

        // 5. Record event for idempotency
        await prisma.webhookEvent.create({
            data: {
                eventId: event.id,
                type: event.type
            }
        });

        console.log(`[WEBHOOK] Processing event ${event.id} (${event.type})`);

        // 6. Process event based on type
        if (event.type === 'subscription.created') {
            const { user_email, tier_name } = event.data || {};

            if (!user_email || !tier_name) {
                console.warn('[WEBHOOK] Missing user_email or tier_name');
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Validate tier name
            const validTiers = ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];
            const normalizedTier = tier_name.toUpperCase();

            if (!validTiers.includes(normalizedTier)) {
                console.warn(`[WEBHOOK] Invalid tier: ${tier_name}`);
                return res.status(400).json({ error: 'Invalid tier' });
            }

            console.log(`[WEBHOOK] New subscription: ${user_email} → ${normalizedTier}`);

            const user = await prisma.user.update({
                where: { email: user_email },
                data: { tier: normalizedTier as any }
            });

            // Award coupon to referrer (if user was referred)
            const referral = await prisma.referral.findUnique({
                where: { referredId: user.id }
            });

            if (referral && referral.status === 'PENDING') {
                // Mark referral as active
                await prisma.referral.update({
                    where: { id: referral.id },
                    data: {
                        status: 'ACTIVE',
                        firstPaymentAt: new Date()
                    }
                });

                // Award coupon to referrer
                await CouponManager.awardCoupon(referral.referrerId, referral.id);

                console.log(`[WEBHOOK] ✓ Coupon awarded to referrer for ${user_email}`);
            }
        }

        // Handle subscription update (tier change)
        if (event.type === 'subscription.updated') {
            const { user_email, tier_name } = event.data || {};

            if (!user_email || !tier_name) {
                console.warn('[WEBHOOK] Missing user_email or tier_name');
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const validTiers = ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];
            const normalizedTier = tier_name.toUpperCase();

            if (!validTiers.includes(normalizedTier)) {
                console.warn(`[WEBHOOK] Invalid tier: ${tier_name}`);
                return res.status(400).json({ error: 'Invalid tier' });
            }

            console.log(`[WEBHOOK] Updating subscription: ${user_email} → ${normalizedTier}`);

            await prisma.user.update({
                where: { email: user_email },
                data: { tier: normalizedTier as any }
            });
        }

        // Handle subscription cancellation
        if (event.type === 'subscription.canceled' || event.type === 'subscription.cancelled') {
            const { user_email } = event.data || {};

            if (!user_email) {
                console.warn('[WEBHOOK] Missing user_email');
                return res.status(400).json({ error: 'Missing user_email' });
            }

            console.log(`[WEBHOOK] Subscription cancelled: ${user_email}`);

            const user = await prisma.user.findUnique({
                where: { email: user_email }
            });

            if (user) {
                // Revoke coupon from referrer
                const referral = await prisma.referral.findUnique({
                    where: { referredId: user.id }
                });

                if (referral && referral.status === 'ACTIVE') {
                    // Mark as churned
                    await prisma.referral.update({
                        where: { id: referral.id },
                        data: {
                            status: 'CHURNED',
                            cancelledAt: new Date()
                        }
                    });

                    // Remove one unused coupon from referrer
                    await CouponManager.revokeCoupon(referral.referrerId, referral.id);

                    console.log(`[WEBHOOK] ✓ Coupon revoked from referrer for ${user_email}`);
                }
            }
        }

        res.json({ received: true });
    } catch (error: any) {
        console.error('[WEBHOOK] Processing error:', error.message);

        // Don't expose internal errors to webhook sender
        res.status(500).json({
            error: 'Webhook processing failed',
            // Only include event ID for tracking
            event_id: req.body?.id
        });
    }
});

export default router;
