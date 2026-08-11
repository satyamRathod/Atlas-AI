import { env } from '@/config/env.js';

import type { TokenBudgetPlan } from './memory.types.js';
import { countTokens } from './token-counter.js';

export interface ComputeHistoryBudgetInput {
  /** Pre-counted token cost of the system prompt's static text (cached by
   * the caller — it never changes between requests). */
  systemPromptTokens: number;
  context: string;
  summary: string;
  memory: string;
  question: string;
}

/**
 * How many tokens are left over for conversation history, once the system
 * prompt, retrieved knowledge context, running summary, semantic-memory
 * facts, the current question, and headroom for the model's reply have all
 * staked their claim. See docs/phases/phase-3-memory.md §3.
 *
 * Returns a *plan* — how much history is allowed to use — not the final
 * `historyTokensUsed`, which the caller only knows after trimming (§4)
 * actually runs; see `chat.service.ts`'s `buildMemoryInfo()`.
 */
export function computeHistoryBudget(input: ComputeHistoryBudgetInput): TokenBudgetPlan {
  const promptOverheadTokens =
    input.systemPromptTokens +
    countTokens(input.context) +
    countTokens(input.summary) +
    countTokens(input.memory) +
    countTokens(input.question);

  const historyBudgetTokens = Math.max(
    0,
    env.MEMORY_MAX_CONTEXT_TOKENS - env.MEMORY_RESERVED_OUTPUT_TOKENS - promptOverheadTokens,
  );

  return {
    maxContextTokens: env.MEMORY_MAX_CONTEXT_TOKENS,
    reservedOutputTokens: env.MEMORY_RESERVED_OUTPUT_TOKENS,
    promptOverheadTokens,
    historyBudgetTokens,
  };
}
