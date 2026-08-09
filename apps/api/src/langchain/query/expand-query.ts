import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const EXPANSION_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You expand search queries to improve retrieval recall. Given the user's
question, output ONE expanded search query that appends closely related
terms, synonyms, and alternate phrasings to the original question — do not
answer the question, do not add commentary, and do not use quotes. Respond
with only the expanded query text.`,
  ],
  ['human', '{question}'],
]);

/**
 * Query expansion — broadens a *single* query with related terms before
 * one retrieval pass, improving recall for underspecified questions (e.g.
 * "reset password" → "reset password forgot password change credentials
 * login authentication"). Distinct from multi-query retrieval, which
 * generates several full alternate queries and retrieves for each.
 */
export async function expandQuery(chatModel: BaseChatModel, query: string): Promise<string> {
  const chain = EXPANSION_PROMPT.pipe(chatModel);
  const response = await chain.invoke({ question: query });
  const expanded = response.text.trim();

  return expanded.length > 0 ? expanded : query;
}
