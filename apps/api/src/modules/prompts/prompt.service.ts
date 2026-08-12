import { env } from '@/config/env.js';

import { BUILT_IN_TEMPLATES } from './built-in-templates.js';
import type { RedisPromptStore } from './infrastructure/redis-prompt-store.js';
import type {
  AddPromptVersionInput,
  CreatePromptTemplateInput,
  PromptTemplateDetail,
  PromptTemplateSummary,
  PromptTemplateVersion,
} from './prompt.types.js';

export class PromptNotFoundError extends Error {
  constructor(id: string) {
    super(`Prompt template "${id}" was not found.`);
    this.name = 'PromptNotFoundError';
  }
}

export class PromptService {
  constructor(private readonly store: RedisPromptStore) {}

  /** Idempotent — safe to call on every boot. Only creates templates that don't already exist. */
  public async seedBuiltInTemplatesIfMissing(): Promise<void> {
    for (const template of BUILT_IN_TEMPLATES) {
      const exists = await this.store.exists(template.id);
      if (!exists) {
        await this.store.createTemplate(template);
      }
    }
  }

  public async listTemplates(): Promise<PromptTemplateSummary[]> {
    return this.store.listSummaries();
  }

  public async getTemplate(id: string): Promise<PromptTemplateDetail> {
    const detail = await this.store.getDetail(id);
    if (!detail) throw new PromptNotFoundError(id);
    return detail;
  }

  /** Falls back to `PROMPT_DEFAULT_TEMPLATE_ID` when `id` is omitted, and to that template's latest version when `version` is omitted — this is what makes both fields fully optional on the chat API without changing default behavior. */
  public async resolveVersion(id?: string, version?: number): Promise<PromptResolvedTemplate> {
    const templateId = id ?? env.PROMPT_DEFAULT_TEMPLATE_ID;
    const [resolved, name] = await Promise.all([
      this.store.getVersion(templateId, version),
      this.store.getName(templateId),
    ]);

    if (!resolved) {
      throw new PromptNotFoundError(
        version === undefined ? templateId : `${templateId}@v${version}`,
      );
    }

    return { templateId, templateName: name ?? templateId, ...resolved };
  }

  public async createTemplate(input: CreatePromptTemplateInput): Promise<PromptTemplateDetail> {
    return this.store.createTemplate(input);
  }

  public async addVersion(
    id: string,
    input: AddPromptVersionInput,
  ): Promise<PromptTemplateVersion> {
    return this.store.addVersion(id, input);
  }
}

/** A resolved, ready-to-render version plus which template id/name it came from — `ChatService` needs these back for `promptInfo`, since the caller may not have specified them explicitly. */
export interface PromptResolvedTemplate extends PromptTemplateVersion {
  templateId: string;
  templateName: string;
}
