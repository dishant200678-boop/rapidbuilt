/**
 * db.ts — MongoDB connection with serverless-safe caching
 *
 * In serverless environments (Netlify Functions), a new module instance
 * may be reused across multiple invocations within the same Lambda container.
 * We cache the Mongoose connection state so we don't open a new connection
 * on every request — which would exhaust MongoDB Atlas connection limits.
 *
 * The module-level `connectionState` object persists between invocations
 * as long as the Lambda container is warm.
 */

import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/** Cached connection state — survives across warm serverless invocations */
const connectionState: { isConnected: boolean } = { isConnected: false };

export async function connectDB(): Promise<void> {
  // Return immediately if already connected (serverless warm-start optimisation)
  if (connectionState.isConnected) {
    logger.debug('MongoDB: reusing existing connection');
    return;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI, {
      // Serverless-friendly connection pool settings
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    connectionState.isConnected = true;
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    connectionState.isConnected = false;
    // In production serverless, throw so the function returns a 500
    // rather than hanging indefinitely
    if (env.NODE_ENV === 'production') {
      throw error;
    }
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection runtime error:', err);
    connectionState.isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    connectionState.isConnected = false;
  });

  // SIGINT handler only registered in long-running processes (local dev)
  // process.exit is NOT called in serverless — the container handles teardown
  if (process.env['AWS_LAMBDA_FUNCTION_NAME'] === undefined &&
      process.env['NETLIFY'] === undefined) {
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  connectionState.isConnected = false;
}
