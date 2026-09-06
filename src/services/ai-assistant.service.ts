/**
 * ai-assistant.service.ts
 * PRAGATI AI Assistant — backend service layer
 *
 * Responsibilities:
 *  1. Build a rich context payload from real PRAGATI data (project, risk, PAiMANA).
 *  2. Call the configured AI provider (OpenAI-compatible API) from the server side.
 *  3. Return a formatted natural-language answer to the controller.
 *
 * Security:
 *  - API keys are NEVER exposed to the frontend.
 *  - All provider calls originate from this server-side service.
 *  - Data access uses existing ProjectService / PaimanaService — permissions are
 *    already enforced there (role / ministry checks).
 */

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ProjectService } from '../modules/projects/project.service.js';
// AnalyticsService reserved for future dashboard context expansion
import { PaimanaService } from './paimana.service.js';
import { Alert } from '../modules/alerts/alert.model.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AssistantRequest {
  prompt: string;
  projectId?: string;
  conversationHistory?: ChatMessage[];
  userId: string;
}

export interface AssistantResponse {
  answer: string;
  projectContextUsed: boolean;
  paimanaContextUsed: boolean;
}

// ---------------------------------------------------------------------------
// PRAGATI product knowledge — injected into every system prompt
// ---------------------------------------------------------------------------

const PRAGATI_SYSTEM_PROMPT = `You are the PRAGATI AI Assistant — an intelligent, expert guide embedded inside the
PRAGATI (Project Risk Assessment & Government Activity Tracking Interface) platform.

PRAGATI is an AI-powered national infrastructure project monitoring and early-warning platform
used by government officers to track, analyse and improve Central Sector project outcomes.

Core Concepts you must understand and explain accurately:
- Risk Score (0–100): AI-computed score based on schedule delay, cost overrun probability, contractor
  performance, milestone delays, and expenditure vs physical progress discrepancy.
- Risk Category: low (0–25), medium (26–50), high (51–75), critical (76–100).
- Physical Progress (%): Actual construction/execution progress on the ground.
- Financial Progress (%): Percentage of funds spent relative to revised project cost.
- Scheduled Progress (%): Expected progress today if project were perfectly on schedule.
- Progress Gap: Scheduled Progress − Physical Progress. Positive gap = behind schedule.
- Cost Growth (%): ((Revised Cost − Original Cost) / Original Cost) × 100.
- Expenditure vs Progress Discrepancy: Financial Progress − Physical Progress.
  Positive = money is being spent faster than work is progressing (burn concern).
- SHAP Factors: The individual risk drivers computed by the AI model (e.g. schedule delay,
  contractor performance, land acquisition status).
- PAiMANA: MoSPI's (Ministry of Statistics & Programme Implementation) official Central Sector
  project monitoring data portal. PAiMANA data in PRAGATI may be simulated/demo unless
  live integration is confirmed. Always clearly state whether data is live or simulated.
- Early Warning: An automated alert triggered when a project's risk score crosses 51 (warning)
  or 76 (critical).
- What-If Analysis: Simulates how changes (e.g. additional budget, improved contractor performance,
  resolved milestones) would alter the project's risk score.
- Dashboard Metrics: Aggregated national-level KPIs across all tracked projects.

Rules you MUST follow:
1. Answer ONLY using data provided in the context below. NEVER invent project names, risk scores,
   PAiMANA records, ministry names, or cost figures.
2. If context data is missing for a question, say clearly: "I don't have data available for that."
3. Convert raw numbers into plain, understandable language. Do NOT dump JSON at the user.
4. Structure your answers where useful using:
   📌 Summary | ⚠️ Risk | 🔍 Why | 📊 Evidence | ✅ Recommended Action
5. Keep language professional, concise, and accessible to government officers.
6. For PAiMANA data: always clarify whether it is live official data or simulated/demo data.
7. You are NOT a generic chatbot. You are a domain specialist for PRAGATI.`;

// ---------------------------------------------------------------------------
// Helper — build a rich project context block
// ---------------------------------------------------------------------------

async function buildProjectContext(projectId: string): Promise<{
  block: string;
  paimanaUsed: boolean;
}> {
  const lines: string[] = [];
  let paimanaUsed = false;

  try {
    // 1. Core project data
    const project = await ProjectService.getProjectById(projectId);

    const scheduledDate = project.scheduledCompletionDate
      ? new Date(project.scheduledCompletionDate).toDateString()
      : 'N/A';
    const revisedDate = project.revisedCompletionDate
      ? new Date(project.revisedCompletionDate).toDateString()
      : 'N/A';

    lines.push('--- PROJECT CONTEXT ---');
    lines.push(`Name: ${project.name}`);
    lines.push(`Code: ${project.projectCode}`);
    lines.push(`Ministry: ${project.ministry}`);
    lines.push(`Sector: ${project.sector}`);
    lines.push(`State: ${project.state}`);
    lines.push(`Status: ${project.status}`);
    lines.push(`Original Cost: ₹${project.originalCost} Cr`);
    lines.push(`Revised Cost: ₹${project.revisedCost} Cr`);
    lines.push(`Actual Expenditure: ₹${project.actualExpenditure} Cr`);
    lines.push(`Cost Growth: ${project.costGrowthPct?.toFixed(1) ?? 'N/A'}%`);
    lines.push(`Physical Progress: ${project.physicalProgressPct}%`);
    lines.push(`Financial Progress: ${project.financialProgressPct}%`);
    lines.push(`Scheduled Progress: ${project.scheduledProgressPct}%`);
    lines.push(`Progress Gap (behind schedule): ${project.progressGap?.toFixed(1) ?? 'N/A'}%`);
    lines.push(
      `Expenditure vs Progress Discrepancy: ${project.expenditureVsProgressDiscrepancy?.toFixed(1) ?? 'N/A'}%`
    );
    lines.push(`Scheduled Completion: ${scheduledDate}`);
    lines.push(`Revised Completion: ${revisedDate}`);
    lines.push(`Contractor: ${project.contractorName ?? 'N/A'}`);
    lines.push(
      `Contractor Performance Score: ${project.contractorPerformanceScore ?? 'N/A'}/100`
    );
    lines.push(`Land Acquisition: ${project.landAcquisitionStatus ?? 'N/A'}`);
    lines.push(`Environmental Clearance: ${project.environmentalClearance ?? 'N/A'}`);
    lines.push(`Milestone Delays: ${project.milestoneDelaysCount}`);

    // 2. AI Risk Assessment
    lines.push('');
    lines.push('--- RISK ASSESSMENT ---');
    lines.push(`Risk Score: ${project.riskScore}/100`);
    lines.push(`Risk Category: ${project.riskCategory?.toUpperCase()}`);
    lines.push(`Delay Probability: ${project.delayProbability}%`);
    lines.push(`Cost Overrun Probability: ${project.costOverrunProbability}%`);
    lines.push(`Expected Delay: ${project.expectedDelayMonths} months`);
    lines.push(`Projected Cost Overrun: ₹${project.projectedCostOverrunCr} Cr`);

    if (project.shapFactors && project.shapFactors.length > 0) {
      lines.push('');
      lines.push('Risk Drivers (SHAP Factors):');
      project.shapFactors.forEach((f, i) => {
        lines.push(`  ${i + 1}. ${f.factor} (contribution: +${f.contribution}) — ${f.description}`);
      });
    }

    if (project.recommendedActions && project.recommendedActions.length > 0) {
      lines.push('');
      lines.push('Recommended Actions:');
      project.recommendedActions.forEach((a, i) => {
        lines.push(`  ${i + 1}. ${a}`);
      });
    }

    // 3. Active Alerts for this project
    try {
      const alerts = await Alert.find({
        projectId: project._id,
        isAcknowledged: false,
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      if (alerts.length > 0) {
        lines.push('');
        lines.push('Active Early Warning Alerts:');
        alerts.forEach((a) => {
          lines.push(`  • [${a.severity.toUpperCase()}] ${a.title} — ${a.reason}`);
        });
      }
    } catch {
      // Non-fatal — alerts are optional context
    }

    // 4. PAiMANA comparison (optional, non-fatal)
    try {
      const comparison = await PaimanaService.compareWithRapidBuilt(projectId);
      if (comparison) {
        paimanaUsed = true;
        lines.push('');
        lines.push(`--- PAiMANA DATA ---`);
        lines.push(`PAiMANA Project ID: ${comparison.paimanaProjectId ?? 'N/A'}`);
        lines.push(`Project Code: ${comparison.projectCode ?? 'N/A'}`);
        lines.push(`Divergence Score: ${comparison.divergenceScore}/100`);
        lines.push(`Discrepancies Found: ${comparison.discrepanciesFound ? 'Yes' : 'No'}`);
        lines.push(`Summary: ${comparison.summary}`);
        if (comparison.comparisons && comparison.comparisons.length > 0) {
          lines.push('Field Comparisons:');
          comparison.comparisons.slice(0, 5).forEach((c) =>
            lines.push(`  • ${c.field}: PRAGATI=${c.rapidbuiltValue ?? 'N/A'}, PAiMANA=${c.paimanaValue ?? 'N/A'}`)
          );
        }
      }
    } catch {
      // PAiMANA data is optional — do not fail the whole request
    }

    lines.push('--- END CONTEXT ---');
  } catch (err: any) {
    logger.warn('[AI Assistant] Could not load project context', {
      projectId,
      error: err?.message,
    });
    lines.push(`(Project context could not be loaded for ID: ${projectId})`);
  }

  return { block: lines.join('\n'), paimanaUsed };
}

// ---------------------------------------------------------------------------
// Core LLM call
// ---------------------------------------------------------------------------

async function callLLM(messages: ChatMessage[]): Promise<string> {
  const provider = (env.AI_PROVIDER ?? 'openai') as 'openai' | 'groq' | 'gemini';

  // ── Resolve API key and endpoint based on provider ──────────────────────────
  let apiKey: string | undefined;
  let model: string;
  let endpoint: string;

  if (provider === 'gemini') {
    apiKey  = env.GEMINI_API_KEY;
    model   = env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    // Gemini's OpenAI-compatible Chat Completions endpoint
    endpoint = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
  } else if (provider === 'groq') {
    apiKey   = env.OPENAI_API_KEY;
    model    = env.OPENAI_MODEL ?? 'llama3-70b-8192';
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  } else {
    // Default: OpenAI
    apiKey   = env.OPENAI_API_KEY;
    model    = env.OPENAI_MODEL ?? 'gpt-4o-mini';
    endpoint = 'https://api.openai.com/v1/chat/completions';
  }

  if (!apiKey) {
    const keyVar = provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    logger.error(`[AI Assistant] ${keyVar} is not configured`);
    throw new Error(`AI_CONFIG_MISSING: Set ${keyVar} in the backend .env file`);
  }

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1024,
  });

  logger.info(`[AI Assistant] Calling ${provider} (model: ${model})`);
  const start = Date.now();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const elapsed = Date.now() - start;

  if (!response.ok) {
    const errText = await response.text();
    logger.error('[AI Assistant] Provider error', {
      status: response.status,
      provider,
      elapsed,
      // Do NOT log apiKey or credentials
    });
    throw new Error(`AI provider returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data: any = await response.json();
  logger.info(`[AI Assistant] LLM response received in ${elapsed}ms`);

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI provider returned an empty response');
  }

  return content.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class AiAssistantService {
  /**
   * Generate an AI response for the given user prompt.
   * If projectId is provided, real project data is fetched and included as context.
   * conversationHistory enables multi-turn conversation memory within a session.
   */
  static async answer(req: AssistantRequest): Promise<AssistantResponse> {
    const { prompt, projectId, conversationHistory = [] } = req;

    let projectContextUsed = false;
    let paimanaContextUsed = false;
    let contextBlock = '';

    if (projectId) {
      const result = await buildProjectContext(projectId);
      contextBlock = result.block;
      projectContextUsed = true;
      paimanaContextUsed = result.paimanaUsed;
    }

    // Build the messages array
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: contextBlock
          ? `${PRAGATI_SYSTEM_PROMPT}\n\n${contextBlock}`
          : PRAGATI_SYSTEM_PROMPT,
      },
      // Include previous turns for conversation memory
      ...conversationHistory.slice(-10), // cap to last 10 turns to control token usage
      {
        role: 'user',
        content: prompt,
      },
    ];

    const answer = await callLLM(messages);

    return {
      answer,
      projectContextUsed,
      paimanaContextUsed,
    };
  }
}
