// Coupon Management Service
// Handles referral coupons with monthly usage limits (max 50% = 10 coupons)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CouponManager {
  /**
   * Get start and end of current month
   */
  private static getCurrentMonth(): { start: Date; end: Date } {
    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    return { start: monthStart, end: monthEnd };
  }

  /**
   * Check how many coupons user can use this month
   */
  static async getMonthlyUsage(userId: string): Promise<{
    couponsUsed: number;
    couponsAvailable: number;
    discountApplied: number;
    canUseMore: boolean;
  }> {
    const { start, end } = this.getCurrentMonth();

    // Get or create monthly discount record
    let monthlyRecord = await prisma.monthlyDiscount.findUnique({
      where: {
        userId_monthStart: {
          userId,
          monthStart: start
        }
      }
    });

    if (!monthlyRecord) {
      monthlyRecord = await prisma.monthlyDiscount.create({
        data: {
          userId,
          monthStart: start,
          monthEnd: end,
          couponsUsed: 0,
          discountApplied: 0
        }
      });
    }

    const maxCouponsPerMonth = 10; // 10 × 5% = 50% max
    const couponsAvailable = maxCouponsPerMonth - monthlyRecord.couponsUsed;

    return {
      couponsUsed: monthlyRecord.couponsUsed,
      couponsAvailable: Math.max(0, couponsAvailable),
      discountApplied: monthlyRecord.discountApplied,
      canUseMore: monthlyRecord.couponsUsed < maxCouponsPerMonth
    };
  }

  /**
   * Get user's available (unused) coupons
   */
  static async getAvailableCoupons(userId: string): Promise<number> {
    const count = await prisma.coupon.count({
      where: {
        userId,
        used: false
      }
    });

    return count;
  }

  /**
   * Apply coupons to a payment (max 50% per month = 10 coupons)
   */
  static async applyCoupons(
    userId: string,
    baseAmount: number,
    dryRun: boolean = false
  ): Promise<{
    discountAmount: number;
    finalAmount: number;
    couponsUsed: number;
    couponsRemaining: number;
  }> {
    const { start, end } = this.getCurrentMonth();

    // Check monthly limit
    const monthlyUsage = await this.getMonthlyUsage(userId);

    if (!monthlyUsage.canUseMore) {
      return {
        discountAmount: 0,
        finalAmount: baseAmount,
        couponsUsed: 0,
        couponsRemaining: await this.getAvailableCoupons(userId)
      };
    }

    // Get available coupons
    const availableCoupons = await prisma.coupon.findMany({
      where: {
        userId,
        used: false
      },
      orderBy: { createdAt: 'asc' }, // Use oldest first
      take: monthlyUsage.couponsAvailable
    });

    if (availableCoupons.length === 0) {
      return {
        discountAmount: 0,
        finalAmount: baseAmount,
        couponsUsed: 0,
        couponsRemaining: 0
      };
    }

    // Calculate discount
    const couponsToUse = Math.min(availableCoupons.length, monthlyUsage.couponsAvailable);
    const discountPercent = couponsToUse * 0.05; // 5% per coupon
    const discountAmount = Math.round(baseAmount * discountPercent);
    const finalAmount = baseAmount - discountAmount;

    // Mark coupons as used
    const couponIds = availableCoupons.slice(0, couponsToUse).map(c => c.id);

    if (!dryRun) {
      await prisma.coupon.updateMany({
        where: {
          id: { in: couponIds }
        },
        data: {
          used: true,
          usedAt: new Date()
        }
      });
    }

    // Update monthly record
    if (!dryRun) {
      await prisma.monthlyDiscount.update({
        where: {
          userId_monthStart: {
            userId,
            monthStart: start
          }
        },
        data: {
          couponsUsed: { increment: couponsToUse },
          discountApplied: { increment: discountPercent }
        }
      });
    }

    const couponsRemaining = await this.getAvailableCoupons(userId);

    return {
      discountAmount,
      finalAmount,
      couponsUsed: couponsToUse,
      couponsRemaining
    };
  }

  /**
   * Explicitly burn a specific number of coupons (e.g. when generating a discount code)
   */
  static async burnCoupons(userId: string, count: number): Promise<void> {
    const { start } = this.getCurrentMonth();

    // Get available coupons to burn
    const coupons = await prisma.coupon.findMany({
      where: {
        userId,
        used: false
      },
      orderBy: { createdAt: 'asc' },
      take: count
    });

    if (coupons.length < count) {
      throw new Error(`Not enough coupons available. Requested: ${count}, Available: ${coupons.length}`);
    }

    const couponIds = coupons.map(c => c.id);

    // Mark as used
    await prisma.coupon.updateMany({
      where: {
        id: { in: couponIds }
      },
      data: {
        used: true,
        usedAt: new Date()
      }
    });

    // Update monthly record
    await prisma.monthlyDiscount.upsert({
      where: {
        userId_monthStart: {
          userId,
          monthStart: start
        }
      },
      update: {
        couponsUsed: { increment: count },
        discountApplied: { increment: count * 0.05 }
      },
      create: {
        userId,
        monthStart: start,
        monthEnd: this.getCurrentMonth().end,
        couponsUsed: count,
        discountApplied: count * 0.05
      }
    });
  }

  /**
   * Award a coupon for successful referral
   */
  static async awardCoupon(
    userId: string,
    referralId: string
  ): Promise<void> {
    await prisma.coupon.create({
      data: {
        userId,
        value: 0.05,
        earnedFrom: referralId
      }
    });

    // Update user stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalReferrals: { increment: 1 },
        activeReferrals: { increment: 1 }
      }
    });
  }

  /**
   * Revoke a coupon when referred user churns
   * (Remove one unused coupon from that referral source)
   */
  static async revokeCoupon(
    userId: string,
    referralId: string
  ): Promise<void> {
    // Find an unused coupon from this referral
    const coupon = await prisma.coupon.findFirst({
      where: {
        userId,
        earnedFrom: referralId,
        used: false
      }
    });

    if (coupon) {
      await prisma.coupon.delete({
        where: { id: coupon.id }
      });
    }

    // Update user stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        activeReferrals: { decrement: 1 }
      }
    });
  }

  /**
   * Get referee's first payment discount (10% one-time)
   */
  static async getFirstPaymentDiscount(
    userId: string,
    baseAmount: number,
    dryRun: boolean = false
  ): Promise<{
    discountAmount: number;
    finalAmount: number;
    applied: boolean;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // Check if user was referred and hasn't used first payment discount
    if (!user?.referredByCode || user.firstPaymentDiscount) {
      return {
        discountAmount: 0,
        finalAmount: baseAmount,
        applied: false
      };
    }

    // Apply 10% discount
    const discountAmount = Math.round(baseAmount * 0.10);
    const finalAmount = baseAmount - discountAmount;

    // Mark as used
    if (!dryRun) {
      await prisma.user.update({
        where: { id: userId },
        data: { firstPaymentDiscount: true }
      });
    }

    return {
      discountAmount,
      finalAmount,
      applied: true
    };
  }

  /**
   * Get user's coupon summary
   */
  static async getSummary(userId: string): Promise<{
    totalCoupons: number;
    usedCoupons: number;
    availableCoupons: number;
    thisMonth: {
      couponsUsed: number;
      couponsAvailable: number;
      discountApplied: number;
    };
    totalSavings: number;
  }> {
    const [totalCoupons, usedCoupons, monthlyUsage] = await Promise.all([
      prisma.coupon.count({ where: { userId } }),
      prisma.coupon.count({ where: { userId, used: true } }),
      this.getMonthlyUsage(userId)
    ]);

    const availableCoupons = totalCoupons - usedCoupons;

    // Calculate total savings (each used coupon = 5% of some payment)
    // This is approximate since we don't track the base amount per coupon
    const totalSavings = usedCoupons * 0.05; // As percentage

    return {
      totalCoupons,
      usedCoupons,
      availableCoupons,
      thisMonth: {
        couponsUsed: monthlyUsage.couponsUsed,
        couponsAvailable: monthlyUsage.couponsAvailable,
        discountApplied: monthlyUsage.discountApplied
      },
      totalSavings
    };
  }
}
