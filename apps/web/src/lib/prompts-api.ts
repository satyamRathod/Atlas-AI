import { API_BASE_URL } from '@/lib/api';
import type {
  PromptFewShotExample,
  PromptTemplateDetail,
  PromptTemplateSummary,
  PromptTemplateVersion,
} from '@/types/chat';

export async function listPromptTemplates(): Promise<PromptTemplateSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/prompts`);
  if (!res.ok) {
    throw new Error(`Failed to list prompt templates (status ${res.status})`);
  }
  const data = (await res.json()) as { templates: PromptTemplateSummary[] };
  return data.templates;
}

export async function getPromptTemplate(
  id: string,
  version?: number,
): Promise<PromptTemplateDetail> {
  const query = version !== undefined ? `?version=${version}` : '';
  const res = await fetch(`${API_BASE_URL}/api/v1/prompts/${encodeURIComponent(id)}${query}`);
  if (!res.ok) {
    throw new Error(`Failed to load prompt template "${id}" (status ${res.status})`);
  }
  return res.json() as Promise<PromptTemplateDetail>;
}

export interface CreatePromptTemplateInput {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  fewShotExamples?: PromptFewShotExample[];
}

export async function createPromptTemplate(
  input: CreatePromptTemplateInput,
): Promise<PromptTemplateDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new Error(
      (body as { message?: string })?.message ??
        `Failed to create prompt template (status ${res.status})`,
    );
  }
  return res.json() as Promise<PromptTemplateDetail>;
}

export interface AddPromptVersionInput {
  systemPrompt: string;
  fewShotExamples?: PromptFewShotExample[];
}

export async function addPromptVersion(
  id: string,
  input: AddPromptVersionInput,
): Promise<PromptTemplateVersion> {
  const res = await fetch(`${API_BASE_URL}/api/v1/prompts/${encodeURIComponent(id)}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new Error(
      (body as { message?: string })?.message ??
        `Failed to save a new version for "${id}" (status ${res.status})`,
    );
  }
  return res.json() as Promise<PromptTemplateVersion>;
}
