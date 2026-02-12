import { SubscriptionTier } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CouponManager } from './coupon-manager';

// Flat tier pricing (in cents)
const TIER_PRICES: Record<SubscriptionTier, number> = {
    FREE: 0,
    STARTER: 2900,
    PRO: 7900,
    ENTERPRISE: 0, // Custom pricing
};

export class BillingService {
    /**
     * Calculate final amount with all discounts applied
     * Uses flat tier-based pricing
     */
    static async calculateInvoiceAmount(
        userId: string,
        _baseTier: string,
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
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        });

        const tier = (user?.tier || 'FREE') as SubscriptionTier;
        const baseAmount = TIER_PRICES[tier];

        // FREE / ENTERPRISE: no discounts needed
        if (baseAmount === 0) {
            return {
                baseAmount,
                firstPaymentDiscount: 0,
                couponDiscount: 0,
                finalAmount: baseAmount,
                couponsUsed: 0,
                breakdown: {
                    base: baseAmount,
                    afterFirstPayment: baseAmount,
                    afterCoupons: baseAmount,
                },
            };
        }

        // Step 1: Apply first payment discount (10% one-time)
        const firstPayment = await CouponManager.getFirstPaymentDiscount(
            userId,
            baseAmount,
            dryRun
        );

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
                afterCoupons: couponResult.finalAmount,
            },
        };
    }

    /**
     * Get discount percentage for display
     */
    static async getDiscountPercentage(userId: string): Promise<{
        thisMonth: number;
        available: number;
        couponsUsed: number;
        couponsRemaining: number;
    }> {
        const summary = await CouponManager.getSummary(userId);

        const thisMonthDiscount = summary.thisMonth.discountApplied;
        const availableDiscount = Math.min(
            summary.availableCoupons * 0.05,
            0.50
        );

        return {
            thisMonth: thisMonthDiscount,
            available: availableDiscount,
            couponsUsed: summary.thisMonth.couponsUsed,
            couponsRemaining: summary.availableCoupons,
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
            select: { email: true, tier: true },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const invoice = await this.calculateInvoiceAmount(userId, user.tier);

        const result: any = {
            user: {
                email: user.email,
                tier: user.tier,
            },
            baseAmount: this.formatAmount(invoice.baseAmount),
            discounts: {},
            totalDiscount: this.formatAmount(
                invoice.firstPaymentDiscount + invoice.couponDiscount
            ),
            finalAmount: this.formatAmount(invoice.finalAmount),
            finalAmountCents: invoice.finalAmount,
        };

        if (invoice.firstPaymentDiscount > 0) {
            result.discounts.firstPayment = {
                label: 'First payment discount',
                amount: this.formatAmount(invoice.firstPaymentDiscount),
                percentage: '10%',
            };
        }

        if (invoice.couponDiscount > 0) {
            result.discounts.coupons = {
                label: `Referral coupons (${invoice.couponsUsed} used)`,
                amount: this.formatAmount(invoice.couponDiscount),
                count: invoice.couponsUsed,
                percentage: `${invoice.couponsUsed * 5}%`,
            };
        }

        return result;
    }
}
