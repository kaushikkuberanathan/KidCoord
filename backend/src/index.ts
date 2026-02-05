/**
 * KidCoord Backend API
 * Main Express application
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

import { logger, createRequestLogger } from '@/utils/logger';
import { testConnection } from '@/utils/database';
import { idempotency } from '@/middleware/idempotency';
import { authenticate } from '@/middleware/auth';
import { StateTransitionError } from '@/utils/stateMachine';

// Import routes
import needsRouter from '@/routes/needs';
import availabilitiesRouter from '@/routes/availabilities';
import offerRequestsRouter from '@/routes/offer-requests';
import rideSessionsRouter from '@/routes/ride-sessions';
import authRouter from '@/routes/auth';
import householdsRouter from '@/routes/households';
import childrenRouter from '@/routes/children';
import vehiclesRouter from '@/routes/vehicles';
import blocklistsRouter from '@/routes/blocklists';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID
app.use((req: any, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging
app.use(createRequestLogger());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', async (req, res) => {
  const dbHealthy = await testConnection();
  
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// API routes
// Auth routes (no authentication required)
app.use('/api/v2/auth', authRouter);

// Protected routes (require authentication)
app.use('/api/v2/needs', authenticate, idempotency, needsRouter);
app.use('/api/v2/availability', authenticate, idempotency, availabilitiesRouter);
app.use('/api/v2/offer-requests', authenticate, idempotency, offerRequestsRouter);
app.use('/api/v2/ride-sessions', authenticate, idempotency, rideSessionsRouter);

// User registration routes (require authentication)
app.use('/api/v2/households', authenticate, householdsRouter);
app.use('/api/v2/children', authenticate, childrenRouter);
app.use('/api/v2/vehicles', authenticate, vehiclesRouter);
app.use('/api/v2/blocklists', authenticate, blocklistsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    requestId: (req as any).id,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id;
  
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    requestId,
    path: req.path,
    method: req.method,
  });
  
  // State transition errors
  if (err instanceof StateTransitionError) {
    return res.status(400).json({
      requestId,
      error: err.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }
  
  // PostgreSQL errors
  if (err.code && err.code.startsWith('23')) {
    // Constraint violation
    return res.status(409).json({
      requestId,
      error: {
        code: 'CONSTRAINT_VIOLATION',
        message: 'Database constraint violated',
        details: err.detail || err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    requestId,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
  try {
    // Test database connection
    const dbHealthy = await testConnection();
    if (!dbHealthy) {
      logger.error('Database connection failed - server will not start');
      process.exit(1);
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`KidCoord API server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0',
      });
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
if (require.main === module) {
  startServer();
}

export default app;
