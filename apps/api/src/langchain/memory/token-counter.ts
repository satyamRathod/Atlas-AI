import type { BaseMessage } from '@langchain/core/messages';
import { getEncoding, type Tiktoken } from 'js-tiktoken';

/**
 * `cl100k_base` (OpenAI's GPT-3.5/4 tokenizer) as an approximation for
 * Groq's `gpt-oss` models — there's no published JS tokenizer for them.
 * This is closer than a `chars / 4` heuristic, but still not exact for this
 * model family; see docs/phases/phase-3-memory.md §3 for why that's an
 * acceptable, documented trade-off (the budgeting/trimming machinery only
 * needs to be consistent with itself, not bit-for-bit accurate to the
 * provider — `usage.total_tokens` on the chat API response is the source of
 * truth for actual billed tokens).
 */
let sharedEncoding: Tiktoken | undefined;

function getSharedEncoding(): Tiktoken {
  sharedEncoding ??= getEncoding('cl100k_base');
  return sharedEncoding;
}

/**
 * Small, fixed per-message overhead to roughly account for chat-format
 * wrapper tokens (role, delimiters) that counting the raw text alone
 * doesn't capture.
 */
const MESSAGE_OVERHEAD_TOKENS = 4;

export function countTokens(text: string): number {
  if (!text) {
    return 0;
  }

  return getSharedEncoding().encode(text).length;
}

/**
 * Token counter shape `trimMessages()` (`@langchain/core/messages`) expects.
 */
export function countMessageTokens(messages: readonly BaseMessage[]): number {
  return messages.reduce(
    (total, message) => total + countTokens(message.text) + MESSAGE_OVERHEAD_TOKENS,
    0,
  );
}
