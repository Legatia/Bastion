// Referral Management Endpoints

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateApiKey } from '../middleware/auth';
import { CouponManager } from '../services/coupon-manager';
import { BillingService } from '../services/billing-service';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * GET /v1/referrals/code
 * Get user's referral code and link
 */
router.get('/referrals/code', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        referralCode: true,
        totalReferrals: true,
        activeReferrals: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const baseUrl = process.env.APP_URL || 'https://bastion.sh';
    const referralUrl = `${baseUrl}/signup?ref=${user.referralCode}`;

    res.json({
      referral_code: user.referralCode,
      referral_url: referralUrl,
      total_referrals: user.totalReferrals,
      active_referrals: user.activeReferrals
    });
  } catch (error) {
    logger.error('Error fetching referral code:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch referral code'
    });
  }
});

/**
 * GET /v1/referrals/stats
 * Get detailed referral statistics
 */
router.get('/referrals/stats', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        totalReferrals: true,
        activeReferrals: true,
        referralsMade: {
          include: {
            referred: {
              select: {
                email: true,
                tier: true,
                createdAt: true
              }
            }
          },
          orderBy: { signupAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Count by status
    const pending = user.referralsMade.filter(r => r.status === 'PENDING').length;
    const active = user.referralsMade.filter(r => r.status === 'ACTIVE').length;
    const churned = user.referralsMade.filter(r => r.status === 'CHURNED').length;

    res.json({
      summary: {
        total_referrals: user.totalReferrals,
        active_referrals: user.activeReferrals,
        pending_referrals: pending,
        churned_referrals: churned
      },
      referrals: user.referralsMade.map(r => ({
        id: r.id,
        email: r.referred.email,
        tier: r.referred.tier,
        status: r.status,
        signup_at: r.signupAt,
        first_payment_at: r.firstPaymentAt,
        cancelled_at: r.cancelledAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching referral stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch referral stats'
    });
  }
});

/**
 * GET /v1/referrals/coupons
 * Get user's coupon balance and usage
 */
router.get('/referrals/coupons', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const summary = await CouponManager.getSummary(req.user.id);
    const discount = await BillingService.getDiscountPercentage(req.user.id);

    res.json({
      total_coupons: summary.totalCoupons,
      used_coupons: summary.usedCoupons,
      available_coupons: summary.availableCoupons,
      this_month: {
        coupons_used: summary.thisMonth.couponsUsed,
        coupons_available: summary.thisMonth.couponsAvailable,
        discount_applied: `${(summary.thisMonth.discountApplied * 100).toFixed(0)}%`
      },
      available_discount: `${(discount.available * 100).toFixed(0)}%`,
      max_monthly_discount: '50%',
      coupon_value: '5%'
    });
  } catch (error) {
    logger.error('Error fetching coupons:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch coupon balance'
    });
  }
});

/**
 * GET /v1/referrals/invoice-preview
 * Preview next invoice with all discounts applied
 */
router.get('/referrals/invoice-preview', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { tier: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Enterprise tier doesn't get discounts
    if (user.tier === 'ENTERPRISE') {
      return res.json({
        tier: user.tier,
        note: 'Enterprise pricing is custom. Coupons not applicable.',
        contact: 'Contact support for pricing details'
      });
    }

    const preview = await BillingService.getInvoicePreview(req.user.id);

    res.json(preview);
  } catch (error) {
    logger.error('Error generating invoice preview:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate invoice preview'
    });
  }
});

/**
 * POST /v1/auth/register
 * Extended to handle referral codes
 */
router.post('/auth/register-with-referral', async (req: Request, res: Response) => {
  try {
    const { email, password, referral_code } = req.body;

    // Validate referral code if provided
    let referrer = null;
    if (referral_code) {
      referrer = await prisma.user.findUnique({
        where: { referralCode: referral_code }
      });

      if (!referrer) {
        return res.status(400).json({ error: 'Invalid referral code' });
      }
    }

    // Create user (reuse existing auth logic)
    // This is just a placeholder - integrate with your existing register endpoint

    res.json({ message: 'Registration with referral code' });
  } catch (error) {
    logger.error('Error registering with referral:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
