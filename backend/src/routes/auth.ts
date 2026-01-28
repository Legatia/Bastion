// Authentication Routes

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

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

        if (!user) {
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
            },
            apiKey: user.apiKey,
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /v1/auth/register
 * Create a new user and return session
 * Supports optional referral code
 */
router.post('/auth/register', async (req: Request, res: Response) => {
    try {
        const { email, password, referral_code } = req.body;

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
                apiKey: `bst_live_${Math.random().toString(36).substring(2, 18)}`,
                tier: 'STARTER',
                referredByCode: referral_code || null,
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

            console.log(`✓ User ${email} signed up with referral code ${referral_code}`);
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier,
            },
            apiKey: user.apiKey,
            referred_by: referral_code ? true : false
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
