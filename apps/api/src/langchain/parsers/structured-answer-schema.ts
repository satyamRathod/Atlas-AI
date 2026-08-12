import { z } from 'zod';

/**
 * Demo schema for the `structuredOutput` chat request flag (§4 of
 * docs/phases/phase-4-prompt-engineering.md). Deliberately small and
 * concrete rather than a generic "any JSON" escape hatch — `sources`
 * mirrors the bracketed `[n]` citations the prose prompt asks for, just as
 * a validated field instead of free text.
 */
export const STRUCTURED_ANSWER_SCHEMA = z.object({
  answer: z
    .string()
    .describe('The direct answer to the question, grounded in the provided context.'),
  confidence: z
    .enum(['low', 'medium', 'high'])
    .describe('How well the context supports this answer.'),
  sources: z
    .array(z.number().int())
    .describe('Indices of the numbered context entries actually used (empty array if none).'),
  followUpQuestions: z
    .array(z.string())
    .max(3)
    .describe('Up to 3 relevant follow-up questions the user might ask next.'),
});

export type StructuredAnswer = z.infer<typeof STRUCTURED_ANSWER_SCHEMA>;
