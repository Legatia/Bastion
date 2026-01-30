// Bastion Backend API Server

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Import middleware
import { requestLogger, logger } from './middleware/logger';

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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Initialize Prisma
const prisma = new PrismaClient();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: true, // Reflects the request origin, allowing any origin with credentials
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger); // Log all requests

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
  });
});

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

// Start the server
startServer();

export default app;
