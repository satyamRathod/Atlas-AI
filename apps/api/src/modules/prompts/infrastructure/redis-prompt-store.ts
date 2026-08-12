import type { Redis } from 'ioredis';

import { env } from '@/config/env.js';

import type {
  AddPromptVersionInput,
  CreatePromptTemplateInput,
  FewShotExample,
  PromptTemplateDetail,
  PromptTemplateSummary,
  PromptTemplateVersion,
} from '../prompt.types.js';

interface IndexEntry {
  name: string;
  description: string;
  createdAt: string;
}

/**
 * Redis-backed prompt-template registry (§2 of
 * docs/phases/phase-4-prompt-engineering.md) — mirrors
 * `RedisChatMemoryStore`'s split between a small index and a per-key list:
 * a hash (`PROMPT_REDIS_PREFIX + 'index'`) maps template id -> name/
 * description/createdAt, and one Redis **list** per template
 * (`PROMPT_REDIS_PREFIX + id + ':versions'`) holds every version ever
 * saved, oldest first (`RPUSH`) — versions are immutable and append-only,
 * so "prompt versioning" here means literally what it says: nothing is
 * ever edited in place, only added.
 *
 * Takes an already-connected `Redis` client, the same long-lived one the
 * API server holds for chat memory (see `createRedisClient()`).
 */
export class RedisPromptStore {
  constructor(private readonly redis: Redis) {}

  public async listSummaries(): Promise<PromptTemplateSummary[]> {
    const index = await this.redis.hgetall(this.indexKey());
    const ids = Object.keys(index);

    if (ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.llen(this.versionsKey(id));
    }
    const results = await pipeline.exec();

    return ids.map((id, i) => {
      const entry = JSON.parse(index[id] as string) as IndexEntry;
      const versionCount = (results?.[i]?.[1] as number) ?? 0;

      return { id, ...entry, latestVersion: versionCount, versionCount };
    });
  }

  public async getDetail(id: string): Promise<PromptTemplateDetail | undefined> {
    const [raw, rawVersions] = await Promise.all([
      this.redis.hget(this.indexKey(), id),
      this.redis.lrange(this.versionsKey(id), 0, -1),
    ]);

    if (!raw) return undefined;

    const entry = JSON.parse(raw) as IndexEntry;
    const versions = rawVersions.map((json) => JSON.parse(json) as PromptTemplateVersion);

    return {
      id,
      ...entry,
      latestVersion: versions.length,
      versionCount: versions.length,
      versions,
    };
  }

  /** `version` defaults to the latest. Returns `undefined` if the template or that specific version doesn't exist. */
  public async getVersion(
    id: string,
    version?: number,
  ): Promise<PromptTemplateVersion | undefined> {
    const index = version === undefined ? -1 : version - 1;
    const raw = await this.redis.lindex(this.versionsKey(id), index);
    return raw ? (JSON.parse(raw) as PromptTemplateVersion) : undefined;
  }

  /** Throws if `id` already exists — templates are created once, then only grow new versions via `addVersion`. */
  public async createTemplate(input: CreatePromptTemplateInput): Promise<PromptTemplateDetail> {
    const entry: IndexEntry = {
      name: input.name,
      description: input.description,
      createdAt: new Date().toISOString(),
    };

    const created = await this.redis.hsetnx(this.indexKey(), input.id, JSON.stringify(entry));
    if (created === 0) {
      throw new Error(`Prompt template "${input.id}" already exists.`);
    }

    const version = await this.appendVersion(input.id, {
      systemPrompt: input.systemPrompt,
      fewShotExamples: input.fewShotExamples ?? [],
    });

    return { id: input.id, ...entry, latestVersion: 1, versionCount: 1, versions: [version] };
  }

  /** Throws if `id` doesn't exist yet — use `createTemplate` first. */
  public async addVersion(
    id: string,
    input: AddPromptVersionInput,
  ): Promise<PromptTemplateVersion> {
    const exists = await this.redis.hexists(this.indexKey(), id);
    if (!exists) {
      throw new Error(`Prompt template "${id}" does not exist.`);
    }

    return this.appendVersion(id, {
      systemPrompt: input.systemPrompt,
      fewShotExamples: input.fewShotExamples ?? [],
    });
  }

  /** `true` only if the template's index entry is missing — used by boot-time seeding to stay idempotent. */
  public async exists(id: string): Promise<boolean> {
    return (await this.redis.hexists(this.indexKey(), id)) === 1;
  }

  public async getName(id: string): Promise<string | undefined> {
    const raw = await this.redis.hget(this.indexKey(), id);
    return raw ? (JSON.parse(raw) as IndexEntry).name : undefined;
  }

  private async appendVersion(
    id: string,
    input: { systemPrompt: string; fewShotExamples: FewShotExample[] },
  ): Promise<PromptTemplateVersion> {
    const versionsKey = this.versionsKey(id);
    const nextVersion = (await this.redis.llen(versionsKey)) + 1;

    const version: PromptTemplateVersion = {
      version: nextVersion,
      systemPrompt: input.systemPrompt,
      fewShotExamples: input.fewShotExamples,
      createdAt: new Date().toISOString(),
    };

    await this.redis.rpush(versionsKey, JSON.stringify(version));
    return version;
  }

  private indexKey(): string {
    return `${env.PROMPT_REDIS_PREFIX}index`;
  }

  private versionsKey(id: string): string {
    return `${env.PROMPT_REDIS_PREFIX}${id}:versions`;
  }
}
