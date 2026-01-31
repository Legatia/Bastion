// Rate Limiting Middleware
// Protects against brute-force attacks and DoS

import rateLimit from 'express-rate-limit';

/**
 * General API rate limit
 * Applies to all endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit. Please try again later.',
    });
  },
});

/**
 * Strict rate limit for authentication endpoints
 * Prevents credential stuffing and brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 authentication attempts per 15 minutes per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth attempts
});

/**
 * Very strict rate limit for webhooks
 * Prevents webhook flooding
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 webhook requests per minute per IP
  message: {
    error: 'Too Many Requests',
    message: 'Webhook rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Moderate rate limit for authorization endpoint
 * Allows legitimate high-frequency policy checks
 */
export const authorizeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP (1 per second average)
  message: {
    error: 'Too Many Requests',
    message: 'Authorization rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limit for policy creation/updates
 * Prevents abuse of policy management
 */
export const policyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 policy operations per minute
  message: {
    error: 'Too Many Requests',
    message: 'Policy operation rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
