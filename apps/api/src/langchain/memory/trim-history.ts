import { type BaseMessage, trimMessages } from '@langchain/core/messages';

import { countMessageTokens } from './token-counter.js';

/**
 * Drops the oldest messages that don't fit within `maxTokens` — the
 * "hard, lossy cutoff" half of Phase 3's memory story (§4); conversation
 * summarization (§5) is what runs *before* this to avoid losing the gist of
 * whatever gets dropped here.
 *
 * `startOn: 'human'` keeps the trimmed result well-formed for
 * `MessagesPlaceholder('history')` — it never starts on a dangling AI turn.
 * `includeSystem: false` because history here is `HumanMessage`/`AIMessage`
 * only; the rolling summary and semantic-memory facts are separate prompt
 * variables, never messages mixed into this list (see `rag-prompt.ts`).
 */
export async function trimHistory(
  messages: readonly BaseMessage[],
  maxTokens: number,
): Promise<BaseMessage[]> {
  if (messages.length === 0) {
    return [];
  }

  return trimMessages([...messages], {
    maxTokens,
    tokenCounter: countMessageTokens,
    strategy: 'last',
    startOn: 'human',
    includeSystem: false,
    allowPartial: false,
  });
}
