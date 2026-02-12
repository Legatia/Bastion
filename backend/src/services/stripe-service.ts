// Stripe Integration Service
// Handles checkout sessions, customer management, and subscriptions

import Stripe from 'stripe';
import { logger } from '../middleware/logger';

export class StripeService {
    private static stripe: Stripe;

    static getClient(): Stripe {
        if (!this.stripe) {
            const secretKey = process.env.STRIPE_SECRET_KEY;
            if (!secretKey) {
                throw new Error('STRIPE_SECRET_KEY not configured');
            }
            this.stripe = new Stripe(secretKey, {
                apiVersion: '2025-02-24.acacia' as any,
            });
        }
        return this.stripe;
    }

    /**
     * Create or retrieve a Stripe Customer ID for a user
     */
    static async getOrCreateCustomer(email: string, name?: string): Promise<string> {
        const stripe = this.getClient();

        // Search for existing customer
        const customers = await stripe.customers.list({ email, limit: 1 });
        if (customers.data.length > 0) {
            return customers.data[0].id;
        }

        // Create new customer
        const customer = await stripe.customers.create({
            email,
            name: name || undefined,
            metadata: { source: 'Bastion' },
        });

        logger.info('[STRIPE] Created new customer', { customerId: customer.id, email });
        return customer.id;
    }

    /**
     * Create a Checkout Session for unified billing (one-time + recurring)
     */
    static async createCheckoutSession(params: {
        customerId: string;
        lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
        returnUrl: string;
        clientReferenceId: string;
        allowPromotionCodes?: boolean;
        metadata?: Record<string, string>;
        mode?: 'subscription' | 'payment';
    }): Promise<{ clientSecret: string | null; sessionId: string }> {
        const stripe = this.getClient();

        // Check if any line items are recurring to determine mode
        const hasRecurring = params.lineItems.some(item =>
            !!(item.price_data?.recurring) || !!(item.price && params.mode === 'subscription')
        );

        // Mode 'subscription' supports both recurring and one-time items
        // Mode 'payment' only supports one-time items
        const mode = params.mode || (hasRecurring ? 'subscription' : 'payment');

        const session = await stripe.checkout.sessions.create({
            customer: params.customerId,
            mode,
            line_items: params.lineItems,
            return_url: params.returnUrl,
            client_reference_id: params.clientReferenceId,
            allow_promotion_codes: params.allowPromotionCodes ?? true,
            ui_mode: 'embedded',
            ...(params.metadata ? { metadata: params.metadata } : {}),
        });

        logger.info('[STRIPE] Created checkout session', {
            sessionId: session.id,
            mode,
            itemCount: params.lineItems.length
        });

        return {
            clientSecret: session.client_secret,
            sessionId: session.id,
        };
    }

    /**
     * Create a Customer Portal session for subscription management
     */
    static async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
        const stripe = this.getClient();
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
        return session.url;
    }

    /**
     * Verify webhook signature
     */
    static constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
        const stripe = this.getClient();
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
        return stripe.webhooks.constructEvent(payload, signature, secret);
    }
}
