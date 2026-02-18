// Authentication Routes

import { Router, Request, Response } from 'express';
import { SubscriptionTier } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * Generate cryptographically secure API key
 */
function generateSecureApiKey(): string {
    const randomBytes = crypto.randomBytes(24); // 192 bits of entropy
    const b64 = randomBytes.toString('base64url'); // URL-safe base64
    return `bst_live_${b64}`;
}

function resolveAdminEmails(): Set<string> {
    const raw = process.env.ADMIN_EMAILS || '';
    return new Set(
        raw
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
    );
}

function isAdminEmail(email: string): boolean {
    return resolveAdminEmails().has(email.trim().toLowerCase());
}

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

/**
 * POST /v1/auth/login
 * Exchange credentials for API Key (Session Token)
 */
router.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email },
        });

        // Use constant-time check to prevent timing attacks
        if (!user) {
            // Still hash to maintain constant time even when user doesn't exist
            await bcrypt.compare(password, '$2a$10$invalidhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Return the API Key to be used as the session token
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier,
                isAdmin: isAdminEmail(user.email),
            },
            apiKey: user.apiKey,
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        logger.error('Login error:', { error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    referral_code: z.string().optional(),
});

/**
 * POST /v1/auth/register
 * Create a new user and return session
 * Supports optional referral code
 */
router.post('/auth/register', async (req: Request, res: Response) => {
    try {
        const { email, password, referral_code } = registerSchema.parse(req.body);

        const existing = await prisma.user.findUnique({
            where: { email },
        });

        if (existing) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Validate referral code if provided
        let referrerId = null;
        if (referral_code) {
            const referrer = await prisma.user.findUnique({
                where: { referralCode: referral_code }
            });

            if (referrer) {
                referrerId = referrer.id;
            } else {
                return res.status(400).json({ error: 'Invalid referral code' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: email.split('@')[0],
                apiKey: generateSecureApiKey(),
                tier: SubscriptionTier.FREE,
                referredByCode: referral_code || null,
                referralCode: `ref_${crypto.randomBytes(6).toString('base64url')}`,
            },
        });

        // Create referral record if referred
        if (referrerId) {
            await prisma.referral.create({
                data: {
                    referrerId,
                    referredId: user.id,
                    status: 'PENDING',
                    signupAt: new Date()
                }
            });

            logger.info('User signed up with referral', { email, referral_code });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier,
                isAdmin: isAdminEmail(user.email),
            },
            apiKey: user.apiKey,
            referred_by: referral_code ? true : false
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        logger.error('Register error:', { error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /v1/auth/google
 * Exchange Google OAuth access token for Bastion API key
 */
router.post('/auth/google', async (req: Request, res: Response) => {
    try {
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(400).json({ error: 'Missing access_token' });
        }

        // Verify token with Google and get user info
        const googleResponse = await fetch(
            `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
        );

        if (!googleResponse.ok) {
            return res.status(401).json({ error: 'Invalid Google token' });
        }

        const googleUser = await googleResponse.json() as {
            id: string;
            email: string;
            name?: string;
            picture?: string;
        };

        if (!googleUser.email) {
            return res.status(400).json({ error: 'Could not get email from Google' });
        }

        // Check if user exists
        let user = await prisma.user.findUnique({
            where: { email: googleUser.email },
        });

        if (!user) {
            // Create new user with Google OAuth
            user = await prisma.user.create({
                data: {
                    email: googleUser.email,
                    password: '', // No password for OAuth users
                    name: googleUser.name || googleUser.email.split('@')[0],
                    apiKey: generateSecureApiKey(),
                    tier: SubscriptionTier.FREE,
                    googleId: googleUser.id,
                    referralCode: `ref_${crypto.randomBytes(6).toString('base64url')}`,
                },
            });
            logger.info('New user created via Google OAuth', { email: googleUser.email });
        } else if (!user.googleId) {
            // Link Google account to existing user
            user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: googleUser.id },
            });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier,
                isAdmin: isAdminEmail(user.email),
            },
            apiKey: user.apiKey,
        });

    } catch (error: any) {
        logger.error('Google auth error:', { error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
