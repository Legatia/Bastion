// Bastion Backend API Server

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config();

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Import middleware
import { requestLogger, logger } from './middleware/logger';
import { validateEnv } from './middleware/env-validation';
import { apiLimiter, authLimiter, webhookLimiter, authorizeLimiter, policyLimiter } from './middleware/rate-limit';

// Validate environment variables
validateEnv();

// Import routes
import authorizeRoutes from './routes/authorize';
import policyRoutes from './routes/policies';
import logRoutes from './routes/logs';
import analyticsRoutes from './routes/analytics';
import agentRoutes from './routes/agents';
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';
import referralRoutes from './routes/referrals';
import usageRoutes from './routes/usage';
import identityRoutes from './routes/identity';
import cognitiveRoutes from './routes/cognitive';
import moduleRoutes from './routes/modules';
import { startMoltMindScheduler, stopMoltMindScheduler } from './services/moltmind-scheduler';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Shared Prisma client
import { prisma } from './lib/prisma';

// CORS Configuration - Whitelist specific origins
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGINS?.split(','),
  process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].flat().filter(Boolean) as string[];

logger.info(`CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[SECURITY] Rejected CORS request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  maxAge: 86400, // 24 hours
}));

// Stripe webhook requires raw body for signature verification
app.use(`/${API_VERSION}/webhooks/stripe`, express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger); // Log all requests

// Apply general rate limit to all API routes EXCEPT /authorize and /webhooks (have their own limiters)
app.use(`/${API_VERSION}`, (req, res, next) => {
  if (req.path === '/authorize' || req.path.startsWith('/webhooks')) return next();
  apiLimiter(req, res, next);
});

// Root endpoint - Serve landing page
// Static files will be served from /public/index.html

// Health check endpoint (no rate limit)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
  });
});

// Apply specific rate limiters to sensitive endpoints
app.use(`/${API_VERSION}/auth/login`, authLimiter);
app.use(`/${API_VERSION}/auth/register`, authLimiter);
app.use(`/${API_VERSION}/webhooks`, webhookLimiter);
app.use(`/${API_VERSION}/authorize`, authorizeLimiter);
app.use(`/${API_VERSION}/policies`, policyLimiter);

// API routes
app.use(`/${API_VERSION}`, authorizeRoutes);
app.use(`/${API_VERSION}`, policyRoutes);
app.use(`/${API_VERSION}`, logRoutes);
app.use(`/${API_VERSION}`, analyticsRoutes);
app.use(`/${API_VERSION}`, agentRoutes);
app.use(`/${API_VERSION}`, authRoutes);
app.use(`/${API_VERSION}`, webhookRoutes);
app.use(`/${API_VERSION}`, referralRoutes);
app.use(`/${API_VERSION}`, usageRoutes);
app.use(`/${API_VERSION}`, identityRoutes);
app.use(`/${API_VERSION}`, cognitiveRoutes); // MoltMind - cognitive monitoring
app.use(`/${API_VERSION}`, moduleRoutes);

// CLI-friendly endpoint aliases
// /v1/audit -> /v1/logs
app.use(`/${API_VERSION}/audit`, logRoutes);

// /v1/stats -> /v1/analytics/summary
import { Router } from 'express';
const statsRouter = Router();
statsRouter.get('/stats', async (req, res, next) => {
  req.url = '/analytics/summary' + (req.url === '/stats' ? '' : req.url.replace('/stats', ''));
  analyticsRoutes(req, res, next);
});
app.use(`/${API_VERSION}`, statsRouter);

// Root route - API info and redirect to frontend
app.get('/', (req: Request, res: Response) => {
  // Check if request is from a browser (has Accept: text/html)
  const acceptsHtml = req.headers.accept?.includes('text/html');

  if (acceptsHtml) {
    // Redirect browsers to the frontend
    return res.redirect('https://bastion.legatia.solutions');
  }

  // Return JSON for API clients
  res.json({
    name: 'Bastion Protocol API',
    version: API_VERSION,
    status: 'online',
    documentation: 'https://github.com/Legatia/Bastion',
    frontend: 'https://bastion.legatia.solutions',
    endpoints: {
      health: '/health',
      auth: {
        register: `/v1/auth/register`,
        login: `/v1/auth/login`,
        google: `/v1/auth/google`,
      },
      api: {
        authorize: `/v1/authorize`,
        policies: `/v1/policies`,
        agents: `/v1/agents`,
        logs: `/v1/logs`,
        analytics: `/v1/analytics`,
      },
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');

  // Stop background schedulers
  stopMoltMindScheduler();

  // Close database connections
  await prisma.$disconnect();

  // Exit process
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✓ Database connected');

    // Start MoltMind background scheduler
    startMoltMindScheduler();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════╗
║   🛡️  Bastion Protocol Backend API          ║
║                                              ║
║   Status: Running                            ║
║   Port: ${PORT}                             ║
║   API Version: ${API_VERSION}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
║                                              ║
║   Endpoints:                                 ║
║   GET  /health                               ║
║   POST /${API_VERSION}/authorize                     ║
║   *    /${API_VERSION}/policies                      ║
║   *    /${API_VERSION}/logs                          ║
║   *    /${API_VERSION}/analytics                     ║
║   *    /${API_VERSION}/agents                        ║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server (only when not running as Vercel serverless function)
if (!process.env.VERCEL) {
  startServer();
}

// Export for Vercel serverless
export default app;
