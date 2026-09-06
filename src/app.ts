/**
 * app.ts — Pure Express application factory
 *
 * This module creates and configures the Express app with all middleware
 * and API routes, but does NOT:
 *   - Start an HTTP listener (that is server.ts's job for local dev)
 *   - Connect to MongoDB (caller is responsible)
 *   - Attach Socket.IO (not supported in serverless)
 *
 * Importable by both:
 *   - src/server.ts  → local development (adds Socket.IO + HTTP server)
 *   - netlify/functions/api.ts → Netlify serverless (wraps with serverless-http)
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes     from './modules/auth/auth.routes.js';
import userRoutes     from './modules/users/user.routes.js';
import projectRoutes  from './modules/projects/project.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import mapsRoutes     from './modules/maps/maps.routes.js';
import paimanaRoutes  from './modules/paimana/paimana.routes.js';
import aiRoutes       from './modules/ai/ai.routes.js';

export function createApp(): Express {
  const app = express();

  // ── Security ──────────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ──────────────────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : true;

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  // ── Body parsing ──────────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── HTTP request logging (skip in test) ──────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // ── Health check (accessible both locally and on Netlify) ─────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'PRAGATI — Project Risk Assessment & Government Activity Tracking Interface',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // Also respond at /api/health so the Netlify rewrite covers it too
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'PRAGATI — Project Risk Assessment & Government Activity Tracking Interface',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // ── API Routes ────────────────────────────────────────────────────────
  app.use('/api/auth',      authRoutes);
  app.use('/api/users',     userRoutes);
  app.use('/api/projects',  projectRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/maps',      mapsRoutes);
  app.use('/api/paimana',   paimanaRoutes);
  app.use('/api/ai',        aiRoutes);

  // ── 404 catch-all ─────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // ── Error handler (must be last) ─────────────────────────────────────
  app.use(errorHandler);

  return app;
}
