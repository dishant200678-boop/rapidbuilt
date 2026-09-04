import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP request logging
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'RapidBuilt backend is running',
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handler must be last
app.use(errorHandler);

// Create HTTP server
const httpServer = http.createServer(app);

// Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Basic socket connection
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Start application
async function startServer(): Promise<void> {
  try {
    await connectDB();

    httpServer.listen(env.PORT, () => {
      logger.info(`RapidBuilt backend running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();