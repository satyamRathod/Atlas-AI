import { z } from 'zod';

import { RETRIEVAL_STRATEGIES } from '@/langchain/retrieval/index.js';

const metadataFilterSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

/**
 * Retrieval strategy/filter overrides are optional and default to the
 * server-configured strategy (`RETRIEVAL_STRATEGY` and friends) when
 * omitted — this keeps the Phase 1 request shape working unchanged while
 * giving a future strategy switcher / chunk-comparison UI (Phase 2 UI)
 * something to call without another backend contract change.
 */
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000),
  sessionId: z.string().trim().optional(),
  retrievalStrategy: z.enum(RETRIEVAL_STRATEGIES as [string, ...string[]]).optional(),
  filters: metadataFilterSchema.optional(),
  useMmr: z.boolean().optional(),
  useRerank: z.boolean().optional(),
  useCompression: z.boolean().optional(),
  useQueryExpansion: z.boolean().optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

const booleanQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

/**
 * `GET /stream` carries the same optional retrieval overrides as `POST /`,
 * but as query-string parameters (`filters` is JSON-encoded since query
 * strings can't express nested objects).
 */
export const chatStreamQuerySchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000),
  sessionId: z.string().trim().optional(),
  retrievalStrategy: z.enum(RETRIEVAL_STRATEGIES as [string, ...string[]]).optional(),
  filters: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;

      try {
        return metadataFilterSchema.parse(JSON.parse(value));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'filters must be a JSON-encoded object' });
        return z.NEVER;
      }
    }),
  useMmr: booleanQueryParam,
  useRerank: booleanQueryParam,
  useCompression: booleanQueryParam,
  useQueryExpansion: booleanQueryParam,
});

export type ChatStreamQueryInput = z.infer<typeof chatStreamQuerySchema>;
