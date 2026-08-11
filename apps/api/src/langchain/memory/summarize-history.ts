import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { type BaseMessage, getBufferString } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * Single-purpose prompt for the rolling summary (§5) — not a full RAG chain
 * invocation, the same "small, dedicated LLM call" shape as Phase 2's
 * query-expansion/multi-query prompts.
 */
const SUMMARY_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You maintain a running summary of an ongoing conversation between a user and an AI assistant.

Given the existing summary (if any) and the new messages below, write an updated summary that folds the new messages into it. Preserve every fact, decision, and stated preference that might matter later; drop small talk and anything already superseded. Be concise — a few sentences, never a transcript.

Respond with ONLY the updated summary text, no preamble or commentary about this task.

Existing summary:
{existingSummary}

New messages:
{newMessages}`,
  ],
]);

/**
 * Folds `messagesToSummarize` into `existingSummary`, producing an updated
 * running summary. Called only when the trigger in §5 fires — most turns
 * never call this.
 */
export async function summarizeHistory(
  chatModel: BaseChatModel,
  existingSummary: string,
  messagesToSummarize: readonly BaseMessage[],
): Promise<string> {
  const chain = SUMMARY_PROMPT.pipe(chatModel);

  const response = await chain.invoke({
    existingSummary: existingSummary || '(none yet — this is the first summary)',
    newMessages: getBufferString([...messagesToSummarize]),
  });

  return response.text.trim();
}
