import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CouponManager } from '../services/coupon-manager';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /v1/webhooks/polar
 * Handle subscription events from Polar.sh
 */
router.post('/webhooks/polar', async (req: Request, res: Response) => {
    // In production, verify the webhook signature header!
    // const signature = req.headers['polar-webhook-signature'];

    console.log('Received Polar Webhook:', JSON.stringify(req.body, null, 2));

    try {
        const event = req.body;

        // Handle subscription creation
        if (event.type === 'subscription.created') {
            const { user_email, tier_name } = event.data;

            if (user_email) {
                console.log(`New subscription: ${user_email} → ${tier_name}`);

                const user = await prisma.user.update({
                    where: { email: user_email },
                    data: { tier: tier_name.toUpperCase() }
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

                    console.log(`✓ Awarded coupon to referrer for ${user_email}`);
                }
            }
        }

        // Handle subscription update (tier change)
        if (event.type === 'subscription.updated') {
            const { user_email, tier_name } = event.data;

            if (user_email) {
                console.log(`Updating subscription: ${user_email} → ${tier_name}`);

                await prisma.user.update({
                    where: { email: user_email },
                    data: { tier: tier_name.toUpperCase() }
                });
            }
        }

        // Handle subscription cancellation
        if (event.type === 'subscription.canceled' || event.type === 'subscription.cancelled') {
            const { user_email } = event.data;

            if (user_email) {
                console.log(`Subscription cancelled: ${user_email}`);

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

                        console.log(`✓ Revoked coupon from referrer for ${user_email}`);
                    }
                }
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
