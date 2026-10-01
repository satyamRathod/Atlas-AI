import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { env } from '@/config/env.js';
import { logger } from '@/infrastructure/logger/index.js';

import { clamp01, heuristicCitationRelevant, mean } from './claim-heuristics.js';
import type {
  ClaimSupport,
  ClaimVerdict,
  EvaluateTurnInput,
  EvaluationRunInfo,
  FaithfulnessResult,
  HallucinationResult,
  MetricScore,
  PrecisionResult,
  RecallResult,
} from './evaluation.types.js';
import {
  buildChunkRelevanceHumanPrompt,
  buildChunkRelevanceSystemPrompt,
  buildClaimExtractionHumanPrompt,
  buildClaimExtractionSystemPrompt,
  buildCorrectnessHumanPrompt,
  buildCorrectnessSystemPrompt,
  buildFaithfulnessHumanPrompt,
  buildFaithfulnessSystemPrompt,
  buildRecallCoverageHumanPrompt,
  buildRecallCoverageSystemPrompt,
} from './evaluation-prompts.js';

const claimsSchema = z.object({
  claims: z.array(z.string()),
});

const faithfulnessSchema = z.object({
  verdicts: z.array(
    z.object({
      support: z.enum(['supported', 'unsupported', 'contradictory']),
      rationale: z.string().nullish(),
    }),
  ),
});

const relevanceSchema = z.object({
  relevant: z.boolean(),
});

const recallSchema = z.object({
  items: z.array(
    z.object({
      claim: z.string(),
      covered: z.boolean(),
    }),
  ),
});

const correctnessSchema = z.object({
  score: z.number().min(0).max(1),
});

/**
 * Hybrid turn evaluator (§1 of docs/phases/phase-9-evaluation.md) —
 * claim-level LLM-as-judge for faithfulness/hallucination, heuristic (+
 * optional LLM) context precision, and ground-truth recall / correctness
 * when provided. Fails open to zeroed scores rather than failing the chat
 * turn if a judge call errors.
 */
export class TurnEvaluator {
  constructor(private readonly chatModel: BaseChatModel) {}

  public async evaluateTurn(input: EvaluateTurnInput): Promise<EvaluationRunInfo> {
    const startedAt = Date.now();
    const mode = input.mode ?? 'turn';
    const maxClaims = env.EVALUATION_MAX_CLAIMS;

    const claims = await this.extractClaims(input.question, input.reply, maxClaims);
    const faithfulness = await this.scoreFaithfulness(input.question, input.context, claims);
    const hallucination = toHallucination(faithfulness);
    const precision = await this.scorePrecision(input);
    const recall = input.groundTruth
      ? await this.scoreRecall(input.question, input.groundTruth, input.context, maxClaims)
      : undefined;
    const correctness = input.expectedAnswer
      ? await this.scoreCorrectness(input.question, input.reply, input.expectedAnswer)
      : undefined;

    const scores: MetricScore[] = [
      { name: 'faithfulness', score: faithfulness.score },
      { name: 'precision', score: precision.score },
      { name: 'hallucination', score: hallucination.rate },
    ];
    if (recall) scores.push({ name: 'recall', score: recall.score });
    if (correctness) scores.push({ name: 'correctness', score: correctness.score });

    return {
      mode,
      scores,
      faithfulness,
      hallucination,
      precision,
      ...(recall ? { recall } : {}),
      ...(correctness ? { correctness } : {}),
      durationMs: Date.now() - startedAt,
    };
  }

  private async extractClaims(
    question: string,
    reply: string,
    maxClaims: number,
  ): Promise<string[]> {
    if (!reply.trim()) return [];

    try {
      const structured = this.chatModel.withStructuredOutput<{ claims: string[] }>(claimsSchema, {
        name: 'eval_claims',
      });
      const result = await structured.invoke([
        new SystemMessage(buildClaimExtractionSystemPrompt()),
        new HumanMessage(buildClaimExtractionHumanPrompt({ question, reply, maxClaims })),
      ]);
      return result.claims
        .map((claim) => claim.trim())
        .filter(Boolean)
        .slice(0, maxClaims);
    } catch (error) {
      logger.error({ error }, 'Evaluation claim extraction failed; treating reply as one claim');
      return [reply.trim().slice(0, 500)];
    }
  }

  private async scoreFaithfulness(
    question: string,
    context: string,
    claims: string[],
  ): Promise<FaithfulnessResult> {
    if (claims.length === 0) {
      return {
        score: 1,
        claims: [],
        supportedCount: 0,
        unsupportedCount: 0,
        contradictoryCount: 0,
      };
    }

    try {
      const structured = this.chatModel.withStructuredOutput<{
        verdicts: { support: ClaimSupport; rationale?: string }[];
      }>(faithfulnessSchema, { name: 'eval_faithfulness' });

      const result = await structured.invoke([
        new SystemMessage(buildFaithfulnessSystemPrompt()),
        new HumanMessage(buildFaithfulnessHumanPrompt({ question, context, claims })),
      ]);

      const verdicts: ClaimVerdict[] = claims.map((claim, index) => {
        const verdict = result.verdicts[index];
        const rationale = verdict?.rationale ?? undefined;
        return {
          claim,
          support: verdict?.support ?? 'unsupported',
          ...(rationale ? { rationale } : {}),
        };
      });

      return summarizeFaithfulness(verdicts);
    } catch (error) {
      logger.error(
        { error, errMessage: error instanceof Error ? error.message : String(error) },
        'Evaluation faithfulness judge failed; marking claims unsupported',
      );
      const verdicts: ClaimVerdict[] = claims.map((claim) => ({
        claim,
        support: 'unsupported' as const,
        rationale: 'Judge call failed.',
      }));
      return summarizeFaithfulness(verdicts);
    }
  }

  private async scorePrecision(input: EvaluateTurnInput): Promise<PrecisionResult> {
    if (input.citations.length === 0) {
      return { score: 0, citationScores: [] };
    }

    const citationScores: PrecisionResult['citationScores'][number][] = [];

    for (const citation of input.citations) {
      const text = citation.content || citation.snippet;
      const heuristic = heuristicCitationRelevant(input.question, input.reply, text);

      if (heuristic.confident) {
        citationScores.push({
          index: citation.index,
          relevant: heuristic.relevant,
          method: 'heuristic',
        });
        continue;
      }

      try {
        const structured = this.chatModel.withStructuredOutput<{ relevant: boolean }>(
          relevanceSchema,
          { name: 'eval_chunk_relevance' },
        );
        const result = await structured.invoke([
          new SystemMessage(buildChunkRelevanceSystemPrompt()),
          new HumanMessage(
            buildChunkRelevanceHumanPrompt({
              question: input.question,
              chunk: text.slice(0, 2000),
            }),
          ),
        ]);
        citationScores.push({
          index: citation.index,
          relevant: result.relevant,
          method: 'llm',
        });
      } catch (error) {
        logger.error({ error }, 'Evaluation chunk-relevance judge failed; using heuristic');
        citationScores.push({
          index: citation.index,
          relevant: heuristic.relevant,
          method: 'heuristic',
        });
      }
    }

    const score = mean(citationScores.map((entry) => (entry.relevant ? 1 : 0)));
    return { score: clamp01(score), citationScores };
  }

  private async scoreRecall(
    question: string,
    groundTruth: string,
    context: string,
    maxClaims: number,
  ): Promise<RecallResult> {
    try {
      const structured = this.chatModel.withStructuredOutput<{
        items: { claim: string; covered: boolean }[];
      }>(recallSchema, { name: 'eval_recall' });

      const result = await structured.invoke([
        new SystemMessage(buildRecallCoverageSystemPrompt()),
        new HumanMessage(
          buildRecallCoverageHumanPrompt({ question, groundTruth, context, maxClaims }),
        ),
      ]);

      const items = result.items.slice(0, maxClaims);
      if (items.length === 0) {
        return { score: 0, groundTruthClaims: [] };
      }

      const covered = items.filter((item) => item.covered).length;
      return {
        score: clamp01(covered / items.length),
        groundTruthClaims: items,
      };
    } catch (error) {
      logger.error({ error }, 'Evaluation recall judge failed');
      return { score: 0, groundTruthClaims: [] };
    }
  }

  private async scoreCorrectness(
    question: string,
    reply: string,
    expectedAnswer: string,
  ): Promise<{ score: number }> {
    try {
      const structured = this.chatModel.withStructuredOutput<{ score: number }>(correctnessSchema, {
        name: 'eval_correctness',
      });
      const result = await structured.invoke([
        new SystemMessage(buildCorrectnessSystemPrompt()),
        new HumanMessage(buildCorrectnessHumanPrompt({ question, reply, expectedAnswer })),
      ]);
      return { score: clamp01(result.score) };
    } catch (error) {
      logger.error({ error }, 'Evaluation correctness judge failed');
      return { score: 0 };
    }
  }
}

function summarizeFaithfulness(verdicts: ClaimVerdict[]): FaithfulnessResult {
  const supportedCount = verdicts.filter((v) => v.support === 'supported').length;
  const unsupportedCount = verdicts.filter((v) => v.support === 'unsupported').length;
  const contradictoryCount = verdicts.filter((v) => v.support === 'contradictory').length;
  const scored = supportedCount + unsupportedCount + contradictoryCount;
  const score = scored === 0 ? 1 : clamp01(supportedCount / scored);

  return {
    score,
    claims: verdicts,
    supportedCount,
    unsupportedCount,
    contradictoryCount,
  };
}

function toHallucination(faithfulness: FaithfulnessResult): HallucinationResult {
  const hallucinated = faithfulness.claims.filter(
    (claim) => claim.support === 'unsupported' || claim.support === 'contradictory',
  );
  const total = faithfulness.claims.length;
  const rate = total === 0 ? 0 : clamp01(hallucinated.length / total);

  return {
    detected: hallucinated.length > 0,
    rate,
    claims: hallucinated,
  };
}
