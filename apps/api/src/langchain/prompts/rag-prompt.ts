import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';

const SYSTEM_PROMPT = `You are Atlas, a helpful AI assistant that answers questions grounded in the provided context.

Rules:
- Answer using ONLY the information in the context below when it is relevant to the question.
- Cite the sources you used inline with bracketed numbers, e.g. [1], [2], matching the numbered context entries.
- If the context does not contain enough information to answer, say so plainly instead of guessing.
- Be concise and direct.

Context:
{context}`;

/**
 * RAG chat prompt.
 *
 * Variables:
 * - `context`: numbered, source-tagged text built from retrieved chunks.
 * - `history`: prior turns of the conversation (BaseMessage[]).
 * - `question`: the current user message.
 */
export const ragPrompt = ChatPromptTemplate.fromMessages([
  ['system', SYSTEM_PROMPT],
  new MessagesPlaceholder('history'),
  ['human', '{question}'],
]);
