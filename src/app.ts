import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { sanitize } from './middlewares/validation';
import logger from './utils/logger';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import workspaceRoutes from './routes/workspaces';
import invitationRoutes from './routes/invitations';
import documentRoutes from './routes/documents';
import citationRoutes from './routes/citations';
import commentRoutes from './routes/comments';
import reviewRoutes from './routes/reviews';
import notificationRoutes from './routes/notifications';
import webhookRoutes from './routes/webhooks';
import uploadRoutes from './routes/uploadRoutes';
import aiRoutes from './routes/ai.routes';
import latexRoutes from './routes/latex';
import semanticScholarRoutes from './routes/semanticScholar';

// Create Express app
const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    env.CORS_ORIGIN,
    env.CORS_ORIGIN_2,
    env.CORS_ORIGIN_3,
  ],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// Sanitize input
app.use(sanitize);

// Webhook routes (before rate limiting and auth)
app.use('/api/webhooks', webhookRoutes);

// Global rate limiting
// app.use('/api', globalRateLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Test route for API root
app.get('/api', (_req, res) => {
  res.json({
    message: 'PaperNest API',
    version: '1.0.0',
    docs: '/api/docs',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api', documentRoutes); // Handles /api/documents/* and /api/workspaces/:workspaceId/documents/*
app.use('/api/documents', citationRoutes); // Handles /api/documents/:documentId/citations/*
app.use('/api', commentRoutes); // Handles /api/comments/* and /api/documents/:documentId/comments/*
app.use('/api', reviewRoutes); // Handles /api/reviews/* and /api/documents/:documentId/versions/:documentBodyId/reviews
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/latex', latexRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/semantic-scholar', semanticScholarRoutes);

// Socket.IO Diagnostic Route (to identify the source of the 404s)
app.all('/socket.io/', (req, res) => {
  logger.info(`[SocketDiagnostic] Request received from ${req.ip}`);
  logger.info(`[SocketDiagnostic] User-Agent: ${req.get('User-Agent')}`);
  logger.info(`[SocketDiagnostic] Method: ${req.method}`);
  logger.info(`[SocketDiagnostic] Query: ${JSON.stringify(req.query)}`);
  
  // Return consistent response for polling/EIO
  res.json({
    sid: "diagnostic-session",
    upgrades: [],
    pingInterval: 25000,
    pingTimeout: 5000
  });
});

// Handle 404
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
