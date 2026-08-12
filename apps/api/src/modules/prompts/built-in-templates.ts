import { DEFAULT_SYSTEM_PROMPT } from '@/langchain/prompts/index.js';

import type { CreatePromptTemplateInput } from './prompt.types.js';

const CONCISE_SYSTEM_PROMPT = `You are Atlas, a helpful AI assistant that answers questions grounded in the provided context.

Rules:
- Be extremely concise — one or two sentences, maximum.
- Cite the sources you used inline with bracketed numbers, e.g. [1], [2], matching the numbered context entries.
- If the context does not contain enough information to answer, say so in a single short sentence instead of guessing.

Context:
{context}

Summary of earlier conversation (empty if this is a new conversation):
{summary}

Known facts about this user/conversation, if any (empty if none recorded):
{memory}`;

/**
 * Seeded once at boot by `seedBuiltInTemplatesIfMissing()` (§2) so the
 * registry always has something to select from, and so `default`'s text
 * matches Phase 1-3's fixed `ragPrompt` exactly — a fresh boot with an
 * empty Redis behaves identically to before Phase 4. `concise` exists so
 * few-shot (§3) and dynamic prompt switching are demonstrable without
 * anyone having to use the editor first.
 */
export const BUILT_IN_TEMPLATES: readonly CreatePromptTemplateInput[] = [
  {
    id: 'default',
    name: 'Default',
    description:
      'The standard grounded RAG assistant — cites sources, admits when context is insufficient.',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
  {
    id: 'concise',
    name: 'Concise',
    description:
      'Same rules as Default, but answers in one or two sentences — ships with few-shot examples.',
    systemPrompt: CONCISE_SYSTEM_PROMPT,
    fewShotExamples: [
      {
        input: 'What is the company\u2019s PTO policy?',
        output: '20 accrued PTO days per year, with up to 5 days rollover. [1]',
      },
      {
        input: 'How do I request time off?',
        output: 'Submit a request through the HR portal at least two weeks in advance. [1]',
      },
    ],
  },
];
