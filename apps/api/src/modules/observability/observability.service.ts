import { randomUUID } from 'node:crypto';

import { env } from '@/config/env.js';
import { logger } from '@/infrastructure/logger/index.js';

import { deriveObservabilityMode, estimateCostUsd, truncateForObservability } from './cost.js';
import type { RedisObservabilityStore } from './infrastructure/redis-observability-store.js';
import type {
  ObservabilityFlags,
  ObservabilityPromptSnapshot,
  ObservabilityStageTiming,
  ObservabilityTurn,
  ObservabilityUsage,
} from './observability.types.js';

export interface RecordTurnInput {
  requestId?: string;
  sessionId: string;
  question: string;
  reply: string;
  model: string;
  prompt: ObservabilityPromptSnapshot;
  usage?: ObservabilityUsage;
  retrieval: { strategy: string; stages: readonly ObservabilityStageTiming[] };
  flags: ObservabilityFlags;
  latency: {
    totalMs: number;
    firstTokenMs?: number;
    /** Extra stages beyond retrieval (e.g. generation, evaluation). */
    extraStages?: readonly ObservabilityStageTiming[];
  };
  error?: string;
}

/**
 * Builds truncated `ObservabilityTurn` records and persists them fail-open
 * via `RedisObservabilityStore` (§3 of docs/phases/phase-10-observability.md).
 */
export class ObservabilityService {
  constructor(private readonly store: RedisObservabilityStore) {}

  public buildTurn(input: RecordTurnInput): ObservabilityTurn {
    const maxChars = env.OBSERVABILITY_PROMPT_MAX_CHARS;
    const usage = input.usage;
    const costUsd = estimateCostUsd(usage, {
      inputPer1k: env.OBSERVABILITY_INPUT_COST_PER_1K_TOKENS,
      outputPer1k: env.OBSERVABILITY_OUTPUT_COST_PER_1K_TOKENS,
    });

    const stages: ObservabilityStageTiming[] = [
      ...input.retrieval.stages.map((stage) => ({
        name: `retrieval:${stage.name}`,
        durationMs: stage.durationMs,
      })),
      ...(input.latency.extraStages ?? []),
      { name: 'total', durationMs: input.latency.totalMs },
    ];

    return {
      turnId: randomUUID(),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      sessionId: input.sessionId,
      createdAt: new Date().toISOString(),
      model: input.model,
      mode: deriveObservabilityMode(input.flags),
      question: input.question,
      replyPreview: truncateForObservability(input.reply, 500),
      prompt: {
        templateId: input.prompt.templateId,
        templateName: input.prompt.templateName,
        version: input.prompt.version,
        usedFewShot: input.prompt.usedFewShot,
        variables: {
          context: truncateForObservability(input.prompt.variables.context, maxChars),
          summary: truncateForObservability(input.prompt.variables.summary, maxChars),
          memory: truncateForObservability(input.prompt.variables.memory, maxChars),
          question: truncateForObservability(input.prompt.variables.question, maxChars),
        },
      },
      ...(usage ? { usage } : {}),
      ...(costUsd !== undefined ? { costUsd } : {}),
      latency: {
        totalMs: input.latency.totalMs,
        ...(input.latency.firstTokenMs !== undefined
          ? { firstTokenMs: input.latency.firstTokenMs }
          : {}),
        stages,
      },
      retrieval: {
        strategy: input.retrieval.strategy,
        stages: input.retrieval.stages,
      },
      flags: input.flags,
      ...(input.error ? { error: input.error } : {}),
    };
  }

  /** Fail-open: never throws to the chat caller. */
  public recordTurn(input: RecordTurnInput): void {
    if (!env.OBSERVABILITY_ENABLED) return;

    try {
      const turn = this.buildTurn(input);
      void this.store.saveTurn(turn).catch((error: unknown) => {
        logger.error({ error, sessionId: input.sessionId }, 'Observability turn persist failed');
      });
    } catch (error) {
      logger.error({ error, sessionId: input.sessionId }, 'Observability turn build failed');
    }
  }
}
