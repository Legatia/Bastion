// Polar.sh API Integration Service
// Handles discount creation and checkout session management

import crypto from 'crypto';
import { logger } from '../middleware/logger';

interface PolarDiscount {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  basis_points?: number; // For percentage (1000 = 10%)
  amount?: number; // For fixed amount in cents
  duration: 'once' | 'forever' | 'repeating';
  duration_in_months?: number;
  starts_at?: string;
  ends_at?: string;
  max_redemptions?: number;
  products?: string[];
  organization_id: string;
  redemptions_count: number;
  created_at: string;
  modified_at: string;
}

interface CreateDiscountParams {
  name: string;
  code?: string;
  type: 'percentage' | 'fixed';
  basis_points?: number;
  amount?: number;
  currency?: string;
  duration: 'once' | 'forever' | 'repeating';
  duration_in_months?: number;
  starts_at?: string;
  ends_at?: string;
  max_redemptions?: number;
  products?: string[];
}

export class PolarService {
  private static readonly API_BASE = 'https://api.polar.sh/v1';
  private static readonly API_KEY = process.env.POLAR_API_KEY || '';
  private static readonly ORG_ID = process.env.POLAR_ORGANIZATION_ID || '';

  /**
   * Validate API configuration
   */
  private static validateConfig(): void {
    if (!this.API_KEY) {
      throw new Error('POLAR_API_KEY not configured in environment variables');
    }
    if (!this.ORG_ID) {
      throw new Error('POLAR_ORGANIZATION_ID not configured in environment variables');
    }
  }

  /**
   * Make authenticated request to Polar API
   */
  private static async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    this.validateConfig();

    const url = `${this.API_BASE}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.API_KEY}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[POLAR] API Error (${response.status}):`, { error: errorText });
      throw new Error(`Polar API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a discount code in Polar.sh
   */
  static async createDiscount(params: CreateDiscountParams): Promise<PolarDiscount> {
    const body: any = {
      name: params.name,
      type: params.type,
      duration: params.duration,
      organization_id: this.ORG_ID,
    };

    // Add code if provided
    if (params.code) {
      body.code = params.code;
    }

    // Add type-specific fields
    if (params.type === 'percentage') {
      if (!params.basis_points) {
        throw new Error('basis_points required for percentage discounts');
      }
      body.basis_points = params.basis_points;
    } else if (params.type === 'fixed') {
      if (!params.amount) {
        throw new Error('amount required for fixed discounts');
      }
      body.amount = params.amount;
      body.currency = params.currency || 'usd';
    }

    // Add optional fields
    if (params.duration === 'repeating' && params.duration_in_months) {
      body.duration_in_months = params.duration_in_months;
    }
    if (params.starts_at) body.starts_at = params.starts_at;
    if (params.ends_at) body.ends_at = params.ends_at;
    if (params.max_redemptions) body.max_redemptions = params.max_redemptions;
    if (params.products) body.products = params.products;

    logger.info('[POLAR] Creating discount:', { name: params.name, code: params.code, type: params.type });

    return this.request<PolarDiscount>('POST', '/discounts/', body);
  }

  /**
   * Get a discount by ID
   */
  static async getDiscount(discountId: string): Promise<PolarDiscount> {
    return this.request<PolarDiscount>('GET', `/discounts/${discountId}`);
  }

  /**
   * Delete a discount
   */
  static async deleteDiscount(discountId: string): Promise<void> {
    await this.request<void>('DELETE', `/discounts/${discountId}`);
    logger.info('[POLAR] Deleted discount:', { discountId });
  }

  /**
   * Generate a unique, user-friendly discount code
   */
  static generateDiscountCode(prefix: string = 'BASTION'): string {
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${randomPart}`;
  }

  /**
   * Create a monthly discount code for a user based on their available coupons
   *
   * Strategy: Combine all available coupons into ONE Polar discount code
   * - Each Bastion coupon = 5%
   * - Max 10 coupons per month = 50% max
   * - Creates a single Polar discount with the total percentage
   * - Code expires at end of current month
   * - Max 1 redemption (prevents reuse)
   */
  static async createMonthlyUserDiscount(
    userId: string,
    userEmail: string,
    availableCoupons: number,
    maxCouponsThisMonth: number
  ): Promise<{
    discount: PolarDiscount;
    code: string;
    percentage: number;
    expiresAt: Date;
  }> {
    // Calculate total discount percentage
    const couponsToUse = Math.min(availableCoupons, maxCouponsThisMonth, 10);

    if (couponsToUse === 0) {
      throw new Error('No coupons available to create discount');
    }

    const discountPercent = couponsToUse * 5; // 5% per coupon
    const basisPoints = discountPercent * 100; // Convert to basis points (5% = 500)

    // Generate unique code
    const code = this.generateDiscountCode('BASTION');

    // Calculate month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Create discount in Polar
    const discount = await this.createDiscount({
      name: `Bastion Referral Discount - ${userEmail} - ${now.toISOString().slice(0, 7)}`,
      code,
      type: 'percentage',
      basis_points: basisPoints,
      duration: 'once', // One-time use
      starts_at: monthStart.toISOString(),
      ends_at: monthEnd.toISOString(),
      max_redemptions: 1, // Can only be used once
    });

    logger.info(`[POLAR] Created discount code`, { userEmail, code, discountPercent });

    return {
      discount,
      code,
      percentage: discountPercent,
      expiresAt: monthEnd,
    };
  }

  /**
   * Create a checkout session with a preset discount
   */
  static async createCheckoutSession(params: {
    productIds: string[];
    discountId?: string;
    allowDiscountCodes?: boolean;
    customerEmail?: string;
    customerName?: string;
    successUrl?: string;
    metadata?: Record<string, string>;
  }): Promise<any> {
    const body: any = {
      products: params.productIds,
      allow_discount_codes: params.allowDiscountCodes ?? true,
    };

    if (params.discountId) {
      body.discount_id = params.discountId;
    }
    if (params.customerEmail) {
      body.customer_email = params.customerEmail;
    }
    if (params.customerName) {
      body.customer_name = params.customerName;
    }
    if (params.successUrl) {
      body.success_url = params.successUrl;
    }
    if (params.metadata) {
      body.metadata = params.metadata;
    }

    logger.info('[POLAR] Creating checkout session');

    return this.request<any>('POST', '/checkouts/', body);
  }

  /**
   * Health check - verify API credentials work
   */
  static async healthCheck(): Promise<boolean> {
    try {
      this.validateConfig();
      // Try to list discounts (requires minimal permissions)
      await this.request<any>('GET', '/discounts/?limit=1');
      return true;
    } catch (error) {
      logger.error('[POLAR] Health check failed:', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }
}
