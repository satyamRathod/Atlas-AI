import type { FewShotExample, RenderablePromptTemplate } from '@/langchain/prompts/index.js';

export type { FewShotExample };

/** One immutable, saved revision of a template — versions are never edited in place, only appended (§2). */
export interface PromptTemplateVersion extends RenderablePromptTemplate {
  version: number;
  createdAt: string;
}

export interface PromptTemplateSummary {
  id: string;
  name: string;
  description: string;
  latestVersion: number;
  versionCount: number;
  createdAt: string;
}

export interface PromptTemplateDetail extends PromptTemplateSummary {
  versions: PromptTemplateVersion[];
}

export interface CreatePromptTemplateInput {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  fewShotExamples?: FewShotExample[] | undefined;
}

export interface AddPromptVersionInput {
  systemPrompt: string;
  fewShotExamples?: FewShotExample[] | undefined;
}
