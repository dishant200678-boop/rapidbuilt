/**
 * ai.routes.ts
 * Mounts the AI Assistant endpoint under /api/ai
 *
 * All routes here require a valid JWT via requireAuth — the AI assistant
 * will never bypass authentication or expose data to unauthenticated users.
 */

import { Router } from 'express';
import { handleAiAssistant, handleAiDiagnose } from './ai.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';

const router = Router();

/**
 * POST /api/ai/assistant
 *
 * Body:
 *   prompt              string  (required) — the user's question
 *   projectId           string  (optional) — MongoDB _id of the currently viewed project
 *   conversationHistory array   (optional) — previous { role, content } message pairs for memory
 *
 * Returns:
 *   { success: true, data: { answer: string, meta: { projectContextUsed, paimanaContextUsed } } }
 */
router.post('/assistant', requireAuth, handleAiAssistant);

/**
 * GET /api/ai/diagnose
 * Development-only diagnostic: makes a minimal test call to the configured AI provider
 * and returns the HTTP status + raw error body (never exposes the API key value).
 */
router.get('/diagnose', requireAuth, handleAiDiagnose);

export default router;

