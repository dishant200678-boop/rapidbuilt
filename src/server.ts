/**
 * server.ts — Local development entry point
 *
 * Imports the Express app from app.ts, attaches Socket.IO,
 * connects to MongoDB, and starts the HTTP listener.
 *
 * This file is used for local development only (npm run dev).
 * Netlify Functions use netlify/functions/api.ts instead.
 */

import http from 'http';

import { createApp }  from './app.js';
import { connectDB }  from './config/db.js';
import { env }        from './config/env.js';
import { logger }     from './utils/logger.js';
import { initSocket } from './sockets/index.js';

async function startServer(): Promise<void> {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Build Express app
    const app = createApp();

    // 3. Wrap in HTTP server for Socket.IO
    const httpServer = http.createServer(app);

    // 4. Attach Socket.IO (local dev only — not available in serverless)
    initSocket(httpServer);

    // 5. Start listening
    httpServer.listen(env.PORT, () => {
      logger.info(`PRAGATI backend running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Health: http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();