import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';

export const SYSTEM_PROMPT = `You are Atlas, a helpful AI assistant that answers questions grounded in the provided context.

Rules:
- Answer using ONLY the information in the context below when it is relevant to the question.
- Cite the sources you used inline with bracketed numbers, e.g. [1], [2], matching the numbered context entries.
- If the context does not contain enough information to answer, say so plainly instead of guessing.
- Be concise and direct.

Context:
{context}

Summary of earlier conversation (empty if this is a new conversation):
{summary}

Known facts about this user/conversation, if any (empty if none recorded):
{memory}`;

/**
 * RAG chat prompt.
 *
 * Variables:
 * - `context`: numbered, source-tagged text built from retrieved chunks
 *   (Phase 1/2).
 * - `summary`: rolling summary of older conversation turns (Phase 3 §5) —
 *   empty until the first summarization trigger fires.
 * - `memory`: retrieved semantic-memory facts relevant to the current
 *   question (Phase 3 §7) — empty when disabled or nothing matched.
 * - `history`: recent, trimmed turns of the conversation (`BaseMessage[]`)
 *   — raw `HumanMessage`/`AIMessage` only, never the summary or memory
 *   facts (Phase 3 §4 explains why those are separate variables instead of
 *   messages mixed into this placeholder).
 * - `question`: the current user message.
 */
export const ragPrompt = ChatPromptTemplate.fromMessages([
  ['system', SYSTEM_PROMPT],
  new MessagesPlaceholder('history'),
  ['human', '{question}'],
]);
