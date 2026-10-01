import { z } from 'zod';

import { RETRIEVAL_STRATEGIES } from '@/langchain/retrieval/index.js';

const metadataFilterSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

/**
 * Retrieval strategy/filter overrides are optional and default to the
 * server-configured strategy (`RETRIEVAL_STRATEGY` and friends) when
 * omitted — this keeps the Phase 1 request shape working unchanged while
 * giving a future strategy switcher / chunk-comparison UI (Phase 2 UI)
 * something to call without another backend contract change.
 */
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000),
  sessionId: z.string().trim().optional(),
  retrievalStrategy: z.enum(RETRIEVAL_STRATEGIES as [string, ...string[]]).optional(),
  filters: metadataFilterSchema.optional(),
  useMmr: z.boolean().optional(),
  useRerank: z.boolean().optional(),
  useCompression: z.boolean().optional(),
  useQueryExpansion: z.boolean().optional(),
  // Prompt Engineering (Phase 4) — all optional, defaulting to the
  // server-configured default template/latest version/no few-shot/prose
  // reply when omitted, same "old shape keeps working" convention as the
  // retrieval overrides above.
  promptTemplateId: z.string().trim().min(1).max(64).optional(),
  promptVersion: z.coerce.number().int().min(1).optional(),
  useFewShot: z.boolean().optional(),
  structuredOutput: z.boolean().optional(),
  // Tools (Phase 5) — `useTools` opts into the bind-tools execute-loop
  // (default `false`, same additive convention as Phase 2/4's overrides).
  // `enabledTools` restricts which registered tools the model may call;
  // omitted/empty means "all registered tools", unknown names are ignored.
  useTools: z.boolean().optional(),
  enabledTools: z.array(z.string().trim().min(1)).optional(),
  // Agents (Phase 6) — `useAgent` opts into the classic text-based ReAct
  // loop instead of native tool-calling; reuses `enabledTools` above to
  // scope which tools the agent may use. Precedence when multiple modes
  // are requested: useAgent > useTools > structuredOutput (§3 of
  // docs/phases/phase-6-agents.md).
  useAgent: z.boolean().optional(),
  // LangGraph (Phase 7) — `useGraph` opts into the explicit StateGraph
  // agent<->tools loop (native bindTools, not Phase 6's text ReAct),
  // reusing `enabledTools` above the same way. Takes precedence over every
  // other mode: useGraph > useAgent > useTools > structuredOutput (§2 of
  // docs/phases/phase-7-langgraph.md).
  useGraph: z.boolean().optional(),
  // Multi-Agent (Phase 8) — `useMultiAgent` opts into the supervisor graph
  // (coordinator routing between planner/researcher/writer/reviewer),
  // reusing `enabledTools` for the researcher specialist. Highest
  // precedence of all modes: useMultiAgent > useGraph > useAgent >
  // useTools > structuredOutput (§4 of docs/phases/phase-8-multi-agent.md).
  useMultiAgent: z.boolean().optional(),
  // Evaluation (Phase 9) — orthogonal to generation modes. When true,
  // scores the final reply (faithfulness / precision / recall /
  // hallucination) after generation completes. Optional ground truth
  // unlocks context recall on a single turn.
  useEvaluation: z.boolean().optional(),
  evaluationGroundTruth: z.string().trim().max(8000).optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

/**
 * Resumes a turn paused by the `human_approval` node's `interrupt()` call
 * (§4). `sessionId` doubles as the LangGraph checkpointer's `thread_id`.
 */
export const chatGraphResumeSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
  approved: z.boolean(),
  feedback: z.string().trim().max(2000).optional(),
});

export type ChatGraphResumeInput = z.infer<typeof chatGraphResumeSchema>;

const booleanQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

/**
 * `GET /stream` carries the same optional retrieval overrides as `POST /`,
 * but as query-string parameters (`filters` is JSON-encoded since query
 * strings can't express nested objects).
 */
export const chatStreamQuerySchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000),
  sessionId: z.string().trim().optional(),
  retrievalStrategy: z.enum(RETRIEVAL_STRATEGIES as [string, ...string[]]).optional(),
  filters: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;

      try {
        return metadataFilterSchema.parse(JSON.parse(value));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'filters must be a JSON-encoded object' });
        return z.NEVER;
      }
    }),
  useMmr: booleanQueryParam,
  useRerank: booleanQueryParam,
  useCompression: booleanQueryParam,
  useQueryExpansion: booleanQueryParam,
  promptTemplateId: z.string().trim().min(1).max(64).optional(),
  promptVersion: z.coerce.number().int().min(1).optional(),
  useFewShot: booleanQueryParam,
  structuredOutput: booleanQueryParam,
  useTools: booleanQueryParam,
  // Comma-joined, e.g. "calculator,get_weather" — query strings can't
  // express arrays natively, same reasoning as `filters`' JSON encoding.
  enabledTools: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
    ),
  useAgent: booleanQueryParam,
  useGraph: booleanQueryParam,
  useMultiAgent: booleanQueryParam,
  useEvaluation: booleanQueryParam,
  evaluationGroundTruth: z.string().trim().max(8000).optional(),
});

export type ChatStreamQueryInput = z.infer<typeof chatStreamQuerySchema>;

/** `GET /graph/resume/stream`'s query-string equivalent of `chatGraphResumeSchema`. */
export const chatGraphResumeStreamQuerySchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
  approved: z.enum(['true', 'false']).transform((value) => value === 'true'),
  feedback: z.string().trim().max(2000).optional(),
});

export type ChatGraphResumeStreamQueryInput = z.infer<typeof chatGraphResumeStreamQuerySchema>;
