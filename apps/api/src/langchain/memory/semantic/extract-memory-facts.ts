import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

const extractionResultSchema = z.object({
  facts: z.array(z.string().trim().min(1)).default([]),
});

/**
 * Extraction is deliberately conservative — most turns contain nothing
 * worth remembering long-term ("what's the refund policy?" isn't a fact
 * about the user), and the prompt asks the model to say so explicitly
 * (empty list) rather than always finding *something* to extract. See
 * docs/phases/phase-3-memory.md §7.1.
 */
const EXTRACTION_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `Given this exchange between a user and an AI assistant, extract any durable facts about the USER worth remembering in future, separate conversations — stated preferences, identity, ongoing goals, constraints.

Most exchanges contain nothing worth remembering long-term — when that's the case, return an empty list. Only extract facts about the user, never facts about the assistant's answer itself.

Respond with ONLY a JSON object of the shape {{"facts": string[]}}, no other text, no markdown code fences.

User: {question}
Assistant: {reply}`,
  ],
]);

/** Pulls the first `{...}` block out of a response that may have stray
 * prose or markdown fencing around the JSON. */
function extractJsonObject(text: string): string {
  const match = /\{[\s\S]*\}/.exec(text);
  return match ? match[0] : text;
}

/**
 * One LLM call, best-effort: on any parse/validation failure this fails
 * closed (returns `[]`) rather than throwing — a missed fact is a much
 * smaller problem than breaking the chat response over a memory feature
 * that's off by default.
 */
export async function extractMemoryFacts(
  chatModel: BaseChatModel,
  question: string,
  reply: string,
): Promise<string[]> {
  const chain = EXTRACTION_PROMPT.pipe(chatModel);

  const response = await chain.invoke({ question, reply });

  try {
    const parsed = JSON.parse(extractJsonObject(response.text));
    return extractionResultSchema.parse(parsed).facts;
  } catch {
    return [];
  }
}
