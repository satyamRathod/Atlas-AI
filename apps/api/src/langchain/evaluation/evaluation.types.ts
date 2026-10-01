/** Named metrics Phase 9 exposes on a turn or benchmark case. */
export type EvaluationMetricName =
  | 'faithfulness'
  | 'precision'
  | 'recall'
  | 'hallucination'
  | 'correctness';

/** One atomic claim scored against retrieved context (LLM-as-judge). */
export type ClaimSupport = 'supported' | 'unsupported' | 'contradictory';

export interface ClaimVerdict {
  claim: string;
  support: ClaimSupport;
  /** Short judge rationale — never required for correctness. */
  rationale?: string;
}

export interface FaithfulnessResult {
  score: number;
  claims: readonly ClaimVerdict[];
  supportedCount: number;
  unsupportedCount: number;
  contradictoryCount: number;
}

export interface HallucinationResult {
  /** True when any claim is unsupported or contradictory. */
  detected: boolean;
  /** Fraction of claims that are hallucinated (unsupported ∪ contradictory). */
  rate: number;
  claims: readonly ClaimVerdict[];
}

export interface PrecisionResult {
  score: number;
  /** Per-citation relevance (0/1 for heuristic, or LLM binary). */
  citationScores: readonly { index: number; relevant: boolean; method: 'heuristic' | 'llm' }[];
}

export interface RecallResult {
  score: number;
  /** Ground-truth claims that were / weren't attributable to retrieved context. */
  groundTruthClaims: readonly { claim: string; covered: boolean }[];
}

/** A single named score for dashboard aggregates. */
export interface MetricScore {
  name: EvaluationMetricName;
  score: number;
}

/**
 * Full evaluation payload for one turn (or one benchmark case). Attached to
 * `ChatResponse.evaluation` / the `done` SSE event when `useEvaluation` is
 * true, and nested under each case in a benchmark run.
 */
export interface EvaluationRunInfo {
  mode: 'turn' | 'benchmark';
  scores: readonly MetricScore[];
  faithfulness: FaithfulnessResult;
  hallucination: HallucinationResult;
  precision: PrecisionResult;
  /** Omitted when the client/benchmark case had no ground-truth answer. */
  recall?: RecallResult;
  /** Benchmark-only: reply vs expectedAnswer. */
  correctness?: { score: number };
  durationMs: number;
}

/** One fixed item in the built-in Phase 9 benchmark dataset. */
export interface BenchmarkCase {
  id: string;
  question: string;
  expectedAnswer: string;
  /** Optional keywords that should appear in retrieved context for a healthy RAG run. */
  expectedContextHints?: readonly string[];
}

/** One case's outcome inside a batch benchmark run. */
export interface BenchmarkCaseResult {
  caseId: string;
  question: string;
  reply: string;
  citationCount: number;
  evaluation: EvaluationRunInfo;
}

/** Aggregate + per-case payload persisted in Redis and returned by the evaluation API. */
export interface BenchmarkRunSummary {
  runId: string;
  createdAt: string;
  caseCount: number;
  /** Mean of each metric across cases that produced that metric. */
  aggregateScores: readonly MetricScore[];
  cases: readonly BenchmarkCaseResult[];
  durationMs: number;
}

/** Inputs to `evaluateTurn()` — shared by per-turn chat eval and the benchmark runner. */
export interface EvaluateTurnInput {
  question: string;
  reply: string;
  /** Concatenated retrieved context text (may be empty / "No relevant…"). */
  context: string;
  citations: readonly EvaluateCitation[];
  groundTruth?: string;
  /** When set, also compute answer correctness (benchmark cases). */
  expectedAnswer?: string;
  mode?: 'turn' | 'benchmark';
}

export interface EvaluateCitation {
  index: number;
  snippet: string;
  content: string;
}
