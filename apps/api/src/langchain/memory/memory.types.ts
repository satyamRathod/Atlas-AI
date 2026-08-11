/** What §3's budgeting math decided, before trimming actually runs. */
export interface TokenBudgetPlan {
  maxContextTokens: number;
  reservedOutputTokens: number;
  promptOverheadTokens: number;
  historyBudgetTokens: number;
}

/** `TokenBudgetPlan` plus what trimming (§4) actually used — powers the
 * chat API's `memory.tokenBudget` block (§8) and, eventually, a token-budget
 * panel UI. */
export interface TokenBudgetInfo extends TokenBudgetPlan {
  historyTokensUsed: number;
}

/** A semantic-memory fact (§7) surfaced for the current turn. */
export interface SemanticFact {
  text: string;
  score: number;
}

/**
 * Per-turn memory metadata attached to the chat API response (§8) —
 * mirrors how Phase 2's `retrieval` block was designed ahead of the
 * retrieval-timeline UI it didn't yet have.
 */
export interface MemoryInfo {
  historyMessageCount: number;
  historyTokens: number;
  /** `true` only on the turn where §5's summarization trigger actually fired. */
  summarized: boolean;
  /** Present whenever a summary exists (not just on turns that just updated it). */
  summary?: string;
  tokenBudget: TokenBudgetInfo;
  semanticFacts: readonly SemanticFact[];
}
