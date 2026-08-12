/**
 * Seed text for the `default` prompt template (`modules/prompts`'
 * `seedBuiltInTemplatesIfMissing()`) — this is exactly what Phase 1-3's
 * `ragPrompt` used as its fixed system prompt, kept as the registry's
 * starting point so a fresh boot behaves identically to before Phase 4.
 *
 * Variables it references:
 * - `context`: numbered, source-tagged text built from retrieved chunks
 *   (Phase 1/2).
 * - `summary`: rolling summary of older conversation turns (Phase 3 §5) —
 *   empty until the first summarization trigger fires.
 * - `memory`: retrieved semantic-memory facts relevant to the current
 *   question (Phase 3 §7) — empty when disabled or nothing matched.
 *
 * (`history`/`question` are always supplied separately as messages, never
 * as `{}`-placeholders in the system prompt text — see `render-prompt.ts`.)
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Atlas, a helpful AI assistant that answers questions grounded in the provided context.

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
