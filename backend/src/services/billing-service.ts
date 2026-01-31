// Billing Service - Integrates coupons with Polar.sh
// Handles discount calculation and invoice adjustments

import { PrismaClient } from '@prisma/client';
import { CouponManager } from './coupon-manager';

const prisma = new PrismaClient();

export class BillingService {
  /**
   * Calculate final amount with all discounts applied
   * (Coupons are not applicable to ENTERPRISE tier)
   */
  static async calculateInvoiceAmount(
    userId: string,
    baseTier: string,
    dryRun: boolean = true
  ): Promise<{
    baseAmount: number;
    firstPaymentDiscount: number;
    couponDiscount: number;
    finalAmount: number;
    couponsUsed: number;
    breakdown: {
      base: number;
      afterFirstPayment: number;
      afterCoupons: number;
    };
  }> {
    // Base prices by tier
    const tierPrices: Record<string, number> = {
      STARTER: 1500,  // $15.00 in cents
      GROWTH: 9900,  // $99.00
      PRO: 29900,     // $299.00
      ENTERPRISE: 0   // Custom pricing, no coupons
    };

    const baseAmount = tierPrices[baseTier] || 0;

    // ENTERPRISE tier: no discounts
    if (baseTier === 'ENTERPRISE' || baseAmount === 0) {
      return {
        baseAmount,
        firstPaymentDiscount: 0,
        couponDiscount: 0,
        finalAmount: baseAmount,
        couponsUsed: 0,
        breakdown: {
          base: baseAmount,
          afterFirstPayment: baseAmount,
          afterCoupons: baseAmount
        }
      };
    }

    // Step 1: Apply first payment discount (10% one-time)
    // For previews (dryRun=true), we just CHECK eligibility, we don't apply it
    // But currently getFirstPaymentDiscount DOES update DB. 
    // We need to fix getFirstPaymentDiscount too if we want real dry run, 
    // but for now, let's look at applyCoupons which is the main risk.
    const firstPayment = await CouponManager.getFirstPaymentDiscount(
      userId,
      baseAmount,
      dryRun
    );

    // NOTE: getFirstPaymentDiscount consumes the discount! 
    // This is also a bug for previews.

    let currentAmount = firstPayment.finalAmount;
    const firstPaymentDiscount = firstPayment.discountAmount;

    // Step 2: Apply referral coupons (max 50% per month)
    const couponResult = await CouponManager.applyCoupons(
      userId,
      currentAmount,
      dryRun
    );

    return {
      baseAmount,
      firstPaymentDiscount,
      couponDiscount: couponResult.discountAmount,
      finalAmount: couponResult.finalAmount,
      couponsUsed: couponResult.couponsUsed,
      breakdown: {
        base: baseAmount,
        afterFirstPayment: currentAmount,
        afterCoupons: couponResult.finalAmount
      }
    };
  }

  /**
   * Get discount percentage for display
   */
  static async getDiscountPercentage(userId: string): Promise<{
    thisMonth: number;      // Percentage discount this month
    available: number;      // Max available discount (coupons * 5%)
    couponsUsed: number;
    couponsRemaining: number;
  }> {
    const summary = await CouponManager.getSummary(userId);

    const thisMonthDiscount = summary.thisMonth.discountApplied;
    const availableDiscount = Math.min(
      summary.availableCoupons * 0.05,
      0.50  // Max 50%
    );

    return {
      thisMonth: thisMonthDiscount,
      available: availableDiscount,
      couponsUsed: summary.thisMonth.couponsUsed,
      couponsRemaining: summary.availableCoupons
    };
  }

  /**
   * Format amount for display
   */
  static formatAmount(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Get invoice preview before charging
   */
  static async getInvoicePreview(userId: string): Promise<{
    user: {
      email: string;
      tier: string;
    };
    baseAmount: string;
    discounts: {
      firstPayment?: {
        label: string;
        amount: string;
        percentage: string;
      };
      coupons?: {
        label: string;
        amount: string;
        count: number;
        percentage: string;
      };
    };
    totalDiscount: string;
    finalAmount: string;
    finalAmountCents: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, tier: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const invoice = await this.calculateInvoiceAmount(userId, user.tier);

    const result: any = {
      user: {
        email: user.email,
        tier: user.tier
      },
      baseAmount: this.formatAmount(invoice.baseAmount),
      discounts: {},
      totalDiscount: this.formatAmount(
        invoice.firstPaymentDiscount + invoice.couponDiscount
      ),
      finalAmount: this.formatAmount(invoice.finalAmount),
      finalAmountCents: invoice.finalAmount
    };

    // Add first payment discount if applied
    if (invoice.firstPaymentDiscount > 0) {
      result.discounts.firstPayment = {
        label: 'First payment discount',
        amount: this.formatAmount(invoice.firstPaymentDiscount),
        percentage: '10%'
      };
    }

    // Add coupon discount if applied
    if (invoice.couponDiscount > 0) {
      result.discounts.coupons = {
        label: `Referral coupons (${invoice.couponsUsed} used)`,
        amount: this.formatAmount(invoice.couponDiscount),
        count: invoice.couponsUsed,
        percentage: `${invoice.couponsUsed * 5}%`
      };
    }

    return result;
  }
}
