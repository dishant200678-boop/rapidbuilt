import { Request, Response, NextFunction } from 'express';
import { AiAssistantService, ChatMessage } from '../../services/ai-assistant.service.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

export async function handleAiAssistant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!; // Set by requireAuth middleware
    const { prompt, projectId, conversationHistory } = req.body as {
      prompt: string;
      projectId?: string;
      conversationHistory?: ChatMessage[];
    };

    // Basic input validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'prompt field is required and must be a non-empty string',
      });
      return;
    }

    if (prompt.trim().length > 2000) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'prompt must be 2000 characters or fewer',
      });
      return;
    }

    logger.info('[AI Assistant] Request received', {
      userId: user.userId,
      role: user.role,
      hasProjectId: !!projectId,
      promptLength: prompt.trim().length,
    });

    const result = await AiAssistantService.answer({
      userId: user.userId,
      prompt: prompt.trim(),
      projectId,
      conversationHistory,
    });

    res.status(200).json({
      success: true,
      data: {
        answer: result.answer,
        meta: {
          projectContextUsed: result.projectContextUsed,
          paimanaContextUsed: result.paimanaContextUsed,
        },
      },
    });
  } catch (err: any) {
    logger.error('[AI Assistant] Error processing request', {
      error: err?.message,
    });

    if (err?.message?.startsWith('AI_CONFIG_MISSING')) {
      res.status(500).json({
        success: false,
        error: 'AI_CONFIG_MISSING',
        message: err.message,
      });
      return;
    }

    next(err);
  }
}

/**
 * GET /api/ai/diagnose
 * Makes a minimal test call to the configured AI provider.
 * Returns HTTP status, raw response body, and config summary.
 * Never exposes the actual API key value.
 */
export async function handleAiDiagnose(
  _req: Request,
  res: Response
): Promise<void> {
  const provider = env.AI_PROVIDER ?? 'openai';
  const model =
    provider === 'gemini'
      ? (env.GEMINI_MODEL ?? 'gemini-2.0-flash')
      : (env.OPENAI_MODEL ?? 'gpt-4o-mini');

  const apiKey =
    provider === 'gemini' ? env.GEMINI_API_KEY : env.OPENAI_API_KEY;

  const endpoint =
    provider === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

  const keyEnvVar = provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  const keyPresent = !!apiKey;
  const keyPrefix  = apiKey ? apiKey.slice(0, 6) + '...' : '(not set)';

  if (!apiKey) {
    res.status(200).json({
      success: false,
      diagnosis: {
        provider,
        model,
        endpoint,
        keyEnvVar,
        keyPresent: false,
        keyPrefix: '(not set)',
        providerHttpStatus: null,
        providerResponse: null,
        error: `${keyEnvVar} is not set in .env`,
      },
    });
    return;
  }

  // Make a minimal test call — single-token prompt
  let providerHttpStatus: number | null = null;
  let providerResponseBody: string | null = null;
  let providerSuccess = false;

  try {
    const testBody = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say "ok"' }],
      max_tokens: 5,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: testBody,
    });

    providerHttpStatus = response.status;
    providerResponseBody = await response.text();
    providerSuccess = response.ok;
  } catch (fetchErr: any) {
    providerResponseBody = `Fetch failed: ${fetchErr?.message}`;
  }

  res.status(200).json({
    success: providerSuccess,
    diagnosis: {
      provider,
      model,
      endpoint,
      keyEnvVar,
      keyPresent,
      keyPrefix,                 // First 6 chars only — safe to log, never the full key
      providerHttpStatus,
      providerSuccess,
      providerResponse: providerResponseBody,  // Full Gemini error body visible here
    },
  });
}

