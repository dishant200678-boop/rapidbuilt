/**
 * netlify/functions/api.ts
 *
 * Netlify Function entry point for the PRAGATI Express backend.
 *
 * All requests to /api/* are rewritten here by netlify.toml.
 * The Express app is wrapped with serverless-http which translates
 * Netlify's event/context objects into Express req/res objects.
 *
 * MongoDB connection is established once and cached across warm invocations.
 *
 * Socket.IO is NOT available here — serverless functions cannot hold
 * persistent TCP connections. broadcastEarlyWarning() no-ops gracefully
 * when called (io is null in sockets/index.ts when initSocket was never called).
 *
 * node-cron scheduled jobs also do NOT run here — no persistent process.
 */

import serverless from 'serverless-http';
import { createApp }  from '../../src/app.js';
import { connectDB }  from '../../src/config/db.js';
import { logger }     from '../../src/utils/logger.js';

// Build the Express app once (module-level — reused across warm invocations)
const app = createApp();

// Wrap Express app as a Netlify/Lambda-compatible handler
const serverlessHandler = serverless(app, {
  // Pass binary MIME types if needed (e.g. file downloads)
  binary: ['image/*', 'application/pdf', 'application/octet-stream'],
});

/**
 * Netlify Functions v2 handler.
 * Connects to MongoDB (cached) then delegates to the Express handler.
 */
export const handler = async (event: any, context: any): Promise<any> => {
  // Tell AWS Lambda / Netlify not to wait for the event loop to drain
  // (important when Mongoose keeps the connection alive)
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();
  } catch (err) {
    logger.error('[Netlify] MongoDB connection failed:', err);
    return {
      statusCode: 503,
      body: JSON.stringify({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database temporarily unavailable' },
      }),
    };
  }

  return serverlessHandler(event, context);
};
