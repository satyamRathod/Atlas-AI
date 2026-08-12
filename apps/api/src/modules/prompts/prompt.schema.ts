import { z } from 'zod';

const fewShotExampleSchema = z.object({
  input: z.string().trim().min(1).max(2000),
  output: z.string().trim().min(1).max(2000),
});

export const createPromptTemplateSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      'id must be lowercase alphanumeric with hyphens (e.g. "concise")',
    ),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).default(''),
  systemPrompt: z.string().trim().min(1).max(8000),
  fewShotExamples: z.array(fewShotExampleSchema).max(10).optional(),
});

export type CreatePromptTemplateRequest = z.infer<typeof createPromptTemplateSchema>;

export const addPromptVersionSchema = z.object({
  systemPrompt: z.string().trim().min(1).max(8000),
  fewShotExamples: z.array(fewShotExampleSchema).max(10).optional(),
});

export type AddPromptVersionRequest = z.infer<typeof addPromptVersionSchema>;

export const getPromptTemplateQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});

export type GetPromptTemplateQuery = z.infer<typeof getPromptTemplateQuerySchema>;
