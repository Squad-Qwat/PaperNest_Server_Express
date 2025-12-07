import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { sanitize } from './middlewares/validation';
import logger from './utils/logger';

// Create Express app
const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
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

// Global rate limiting
app.use('/api', globalRateLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API Routes
// TODO: Import and use routes here
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/workspaces', workspaceRoutes);
// app.use('/api/documents', documentRoutes);
// app.use('/api/citations', citationRoutes);
// app.use('/api/reviews', reviewRoutes);
// app.use('/api/comments', commentRoutes);
// app.use('/api/ai', aiRoutes);
// app.use('/api/notifications', notificationRoutes);

// Test route
app.get('/api', (_req, res) => {
  res.json({
    message: 'PaperNest API',
    version: '1.0.0',
    docs: '/api/docs',
  });
});

// Handle 404
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
