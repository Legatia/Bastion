// Environment Variable Validation
// Validates required env vars on startup to fail fast

import { logger } from './logger';

interface EnvConfig {
    required: string[];
    optional: string[];
}

const envConfig: EnvConfig = {
    required: [
        'DATABASE_URL',
        'JWT_SECRET',
    ],
    optional: [
        'PORT',
        'NODE_ENV',
        'LOG_LEVEL',
        'FRONTEND_URL',
        'ALLOWED_ORIGINS',
        'BACKEND_URL',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_ID_STARTER',
        'STRIPE_PRICE_ID_PRO',
        'STRIPE_PRICE_ID_OPENCLAW',
        'CDP_API_KEY_ID',
        'CDP_API_KEY_SECRET',
        'CDP_WALLET_SECRET',
        'ADMIN_EMAILS',
        'ATTESTATION_CONTRACT_ADDRESS',
        'ATTESTATION_NETWORK',
        'ATTESTATION_WALLET_NAME',
        'ATTESTATION_RPC_URL',
        'ATTEST_DECISION_ACTION_TYPES',
        'ATTEST_HEALTH_ENABLED',
        'ATTEST_HEALTH_INTERVAL_HOURS',
        'ATTEST_HEALTH_MIN_EVENTS',
    ],
};

export function validateEnv(): void {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const envVar of envConfig.required) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    // Warn about recommended but missing optional vars in production
    if (process.env.NODE_ENV === 'production') {
        const productionRecommended = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_STARTER', 'STRIPE_PRICE_ID_PRO', 'BACKEND_URL'];
        for (const envVar of productionRecommended) {
            if (!process.env[envVar]) {
                warnings.push(envVar);
            }
        }

        if (!process.env.FRONTEND_URL) {
            missing.push('FRONTEND_URL');
        }
    }

    // Log warnings
    if (warnings.length > 0) {
        logger.warn('Missing recommended environment variables for production:', { variables: warnings });
    }

    // Fail if required vars are missing
    if (missing.length > 0) {
        logger.error('Missing required environment variables:', { variables: missing });
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate JWT_SECRET strength in production
    if (process.env.NODE_ENV === 'production') {
        const jwtSecret = process.env.JWT_SECRET || '';
        if (jwtSecret.length < 32) {
            logger.warn('JWT_SECRET should be at least 32 characters for production security');
        }
        if (jwtSecret.includes('your') || jwtSecret.includes('secret') || jwtSecret.includes('change')) {
            logger.error('JWT_SECRET appears to be a placeholder value. Use a strong random secret in production.');
            throw new Error('JWT_SECRET is not secure for production');
        }

        try {
            // Fail fast if FRONTEND_URL cannot be used for checkout/portal return URLs.
            new URL(process.env.FRONTEND_URL as string);
        } catch {
            logger.error('FRONTEND_URL must be a valid absolute URL in production');
            throw new Error('Invalid FRONTEND_URL');
        }
    }

    logger.info('✓ Environment validation passed');
}
