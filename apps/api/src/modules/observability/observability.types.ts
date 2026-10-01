/** Generation mode that produced this turn — derived from request flags. */
export type ObservabilityMode =
  | 'multi_agent'
  | 'graph'
  | 'agent'
  | 'tools'
  | 'structured'
  | 'normal';

export interface ObservabilityUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ObservabilityStageTiming {
  name: string;
  durationMs: number;
}

export interface ObservabilityPromptSnapshot {
  templateId: string;
  templateName: string;
  version: number;
  usedFewShot: boolean;
  variables: {
    context: string;
    summary: string;
    memory: string;
    question: string;
  };
}

export interface ObservabilityFlags {
  useTools: boolean;
  useAgent: boolean;
  useGraph: boolean;
  useMultiAgent: boolean;
  useEvaluation: boolean;
  structuredOutput: boolean;
  /** True when the graph paused for human approval (no final reply yet). */
  interrupted?: boolean;
}

/**
 * One completed (or interrupted) chat turn persisted for Phase 10
 * monitoring — the unit of "tracing" without OpenTelemetry/LangSmith.
 */
export interface ObservabilityTurn {
  turnId: string;
  requestId?: string;
  sessionId: string;
  createdAt: string;
  model: string;
  mode: ObservabilityMode;
  question: string;
  replyPreview: string;
  prompt: ObservabilityPromptSnapshot;
  usage?: ObservabilityUsage;
  /** Estimated USD from env $/1K rates — not live billing. */
  costUsd?: number;
  latency: {
    totalMs: number;
    firstTokenMs?: number;
    stages: readonly ObservabilityStageTiming[];
  };
  retrieval: {
    strategy: string;
    stages: readonly ObservabilityStageTiming[];
  };
  flags: ObservabilityFlags;
  error?: string;
}

/** Lightweight list row for `GET /turns` (same shape as full turn for simplicity). */
export type ObservabilityTurnSummary = ObservabilityTurn;

export interface ObservabilityMetrics {
  requestCount: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  byMode: readonly { mode: ObservabilityMode; count: number }[];
  retrievalStageAvgMs: readonly ObservabilityStageTiming[];
  /** How many turns were included in this rollup. */
  sampleSize: number;
}

export interface TokenCostRates {
  inputPer1k: number;
  outputPer1k: number;
}
