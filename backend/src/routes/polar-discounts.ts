// Polar.sh Discount Code Routes
// Allows users to generate and retrieve monthly discount codes for Polar checkout

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateApiKey } from '../middleware/auth';
import { logger } from '../middleware/logger';
import { PolarService } from '../services/polar-service';
import { CouponManager } from '../services/coupon-manager';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /v1/polar/discount-code
 * Get or generate current month's Polar discount code
 *
 * Returns the user's discount code for the current month.
 * If no code exists, generates one based on available coupons.
 */
router.get('/polar/discount-code', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // Get optional couponsToUse parameter (1-10)
    const requestedCoupons = req.query.couponsToUse
      ? Math.min(Math.max(parseInt(req.query.couponsToUse as string, 10), 1), 10)
      : undefined;

    // Get current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // Check if discount code already exists for this month
    let existingCode = await prisma.polarDiscountCode.findFirst({
      where: {
        userId,
        monthStart,
      },
    });

    // If code exists and hasn't expired, return it
    if (existingCode && new Date(existingCode.expiresAt) > now) {
      return res.json({
        code: existingCode.code,
        percentage: existingCode.percentage,
        couponsUsed: existingCode.couponsUsed,
        expiresAt: existingCode.expiresAt,
        polarDiscountId: existingCode.polarDiscountId,
        redeemed: existingCode.redeemed,
        isNewCode: false,
      });
    }

    // Get user's coupon status
    const [availableCoupons, monthlyUsage] = await Promise.all([
      CouponManager.getAvailableCoupons(userId),
      CouponManager.getMonthlyUsage(userId),
    ]);

    // Check if user has coupons available
    if (availableCoupons === 0) {
      return res.status(400).json({
        error: 'No coupons available',
        message: 'You need to earn referral coupons before generating a discount code.',
        availableCoupons: 0,
      });
    }

    // Check if user can use more coupons this month
    if (!monthlyUsage.canUseMore) {
      return res.status(400).json({
        error: 'Monthly limit reached',
        message: `You've already used the maximum ${monthlyUsage.couponsUsed} coupons this month.`,
        nextResetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      });
    }

    // Determine how many coupons to use
    const couponsToUse = requestedCoupons !== undefined
      ? Math.min(requestedCoupons, availableCoupons, monthlyUsage.couponsAvailable)
      : Math.min(availableCoupons, monthlyUsage.couponsAvailable);

    // Generate Polar discount code
    const polarDiscount = await PolarService.createMonthlyUserDiscount(
      userId,
      userEmail,
      couponsToUse,
      monthlyUsage.couponsAvailable
    );

    // Store in database
    const savedCode = await prisma.polarDiscountCode.create({
      data: {
        userId,
        polarDiscountId: polarDiscount.discount.id,
        code: polarDiscount.code,
        percentage: polarDiscount.percentage,
        couponsUsed: couponsToUse,
        monthStart,
        monthEnd: polarDiscount.expiresAt,
        expiresAt: polarDiscount.expiresAt,
      },
    });

    // Burn the coupons immediately so they don't show as available
    await CouponManager.burnCoupons(userId, savedCode.couponsUsed);

    logger.info('[POLAR] Generated discount code', { userEmail, code: polarDiscount.code, percentage: polarDiscount.percentage });

    res.json({
      code: savedCode.code,
      percentage: savedCode.percentage,
      couponsUsed: savedCode.couponsUsed,
      expiresAt: savedCode.expiresAt,
      polarDiscountId: savedCode.polarDiscountId,
      redeemed: false,
      isNewCode: true,
      message: `Apply code "${savedCode.code}" at Polar checkout to get ${savedCode.percentage}% off!`,
    });
  } catch (error: any) {
    logger.error('[POLAR] Error generating discount code:', { error: error.message });

    // Handle Polar API errors
    if (error.message?.includes('Polar API error')) {
      return res.status(502).json({
        error: 'Payment provider error',
        message: 'Failed to generate discount code. Please try again later.',
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate discount code',
    });
  }
});

/**
 * GET /v1/polar/discount-status
 * Get current discount code status and available coupons
 *
 * Returns information about user's coupons and discount eligibility
 */
router.get('/polar/discount-status', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get coupon summary
    const [summary, monthlyUsage, availableCoupons] = await Promise.all([
      CouponManager.getSummary(userId),
      CouponManager.getMonthlyUsage(userId),
      CouponManager.getAvailableCoupons(userId),
    ]);

    // Check for existing Polar code this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const existingCode = await prisma.polarDiscountCode.findFirst({
      where: {
        userId,
        monthStart,
      },
    });

    // Calculate potential discount
    const potentialCoupons = Math.min(
      availableCoupons,
      monthlyUsage.couponsAvailable,
      10 // Max 10 coupons
    );
    const potentialDiscount = potentialCoupons * 5;

    res.json({
      coupons: {
        total: summary.totalCoupons,
        used: summary.usedCoupons,
        available: availableCoupons,
      },
      thisMonth: {
        couponsUsed: monthlyUsage.couponsUsed,
        couponsAvailable: monthlyUsage.couponsAvailable,
        discountApplied: monthlyUsage.discountApplied,
        canUseMore: monthlyUsage.canUseMore,
      },
      polarDiscount: existingCode
        ? {
          code: existingCode.code,
          percentage: existingCode.percentage,
          expiresAt: existingCode.expiresAt,
          redeemed: existingCode.redeemed,
        }
        : null,
      potentialDiscount: {
        coupons: potentialCoupons,
        percentage: potentialDiscount,
        message:
          potentialCoupons > 0
            ? `You can get ${potentialDiscount}% off by using ${potentialCoupons} coupon${potentialCoupons > 1 ? 's' : ''}`
            : 'Earn coupons by referring friends to get discounts',
      },
    });
  } catch (error: any) {
    logger.error('[POLAR] Error fetching discount status:', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch discount status',
    });
  }
});

/**
 * POST /v1/polar/webhook/redemption
 * Internal webhook to mark discount code as redeemed
 *
 * This should be called by Polar webhook handler when a discount is used
 * (Not exposed publicly - called internally)
 */
router.post('/polar/webhook/redemption', async (req: Request, res: Response) => {
  try {
    const { polar_discount_id } = req.body;

    if (!polar_discount_id) {
      return res.status(400).json({ error: 'Missing polar_discount_id' });
    }

    // Find and update the discount code
    const discountCode = await prisma.polarDiscountCode.findUnique({
      where: { polarDiscountId: polar_discount_id },
    });

    if (!discountCode) {
      logger.warn('[POLAR] Discount code not found:', { polar_discount_id });
      return res.status(404).json({ error: 'Discount code not found' });
    }

    // Mark as redeemed
    await prisma.polarDiscountCode.update({
      where: { id: discountCode.id },
      data: {
        redeemed: true,
        redeemedAt: new Date(),
      },
    });

    // Mark the coupons as used
    // await CouponManager.applyCoupons(discountCode.userId, 0); // Coupons are now burnt on generation, not redemption

    logger.info('[POLAR] Discount code redeemed', { code: discountCode.code, userId: discountCode.userId });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[POLAR] Error processing redemption webhook:', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
