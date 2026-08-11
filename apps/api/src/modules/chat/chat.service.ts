import { randomUUID } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  type AIMessageChunk,
  type BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { concat } from '@langchain/core/utils/stream';

import { env } from '@/config/env.js';
import { logger } from '@/infrastructure/logger/index.js';
import {
  computeHistoryBudget,
  countMessageTokens,
  countTokens,
  extractMemoryFacts,
  type MemoryInfo,
  type SemanticFact,
  type SemanticMemoryStore,
  summarizeHistory,
  type TokenBudgetPlan,
  trimHistory,
} from '@/langchain/memory/index.js';
import { ragPrompt, SYSTEM_PROMPT } from '@/langchain/prompts/index.js';
import type { RetrievalPipeline, RetrievalStrategy } from '@/langchain/retrieval/index.js';
import type { RetrievedChunk } from '@/langchain/retrievers/index.js';

import type { ChatRequestInput } from './chat.schema.js';
import type {
  ChatCitation,
  ChatResponse,
  RetrievalInfo,
  RetrievalOptions,
  StreamChunk,
  StreamOptions,
} from './chat.types.js';
import type { RedisChatMemoryStore } from './infrastructure/redis-chat-memory-store.js';

interface RagChainInput {
  context: string;
  summary: string;
  memory: string;
  history: BaseMessage[];
  question: string;
}

/** Result of loading + (maybe) summarizing/compacting a session's memory
 * for the current turn — see `prepareMemoryContext()`. */
interface MemoryContext {
  /** The raw history that will actually be sent this turn, *before*
   * token-budget trimming (§4) — either the full stored history, or just
   * the kept tail if summarization (§5) just ran. */
  rawMessages: BaseMessage[];
  summary: string;
  summarized: boolean;
  semanticFacts: SemanticFact[];
}

/** Token cost of the system prompt's static text, counted once at module
 * load — it never changes between requests. Placeholder tokens
 * (`{context}` etc., replaced before the model ever sees them) are
 * stripped first so they aren't double-counted alongside §3's separate
 * `context`/`summary`/`memory`/`question` counts. */
const SYSTEM_PROMPT_STATIC_TOKENS = countTokens(SYSTEM_PROMPT.replace(/\{\w+\}/g, ''));

export class ChatService {
  /** LCEL chain: prompt template piped into the active chat model provider. */
  private readonly chain: Runnable<RagChainInput, AIMessageChunk>;

  constructor(
    private readonly chatModel: BaseChatModel,
    private readonly retrievalPipeline: RetrievalPipeline,
    private readonly historyStore: RedisChatMemoryStore,
    private readonly semanticMemoryStore?: SemanticMemoryStore,
  ) {
    this.chain = ragPrompt.pipe(this.chatModel);
  }

  public async invoke(request: ChatRequestInput): Promise<ChatResponse> {
    const sessionId = request.sessionId ?? randomUUID();

    const [{ chunks, retrieval }, memoryContext] = await Promise.all([
      this.retrieve(request.message, toRetrievalOptions(request)),
      this.prepareMemoryContext(sessionId, request.message),
    ]);

    const context = this.buildContext(chunks);
    const memoryBlock = this.buildMemoryBlock(memoryContext.semanticFacts);
    const budgetPlan = this.computeBudget(
      context,
      memoryContext.summary,
      memoryBlock,
      request.message,
    );
    const history = await trimHistory(memoryContext.rawMessages, budgetPlan.historyBudgetTokens);

    const response = await this.chain.invoke({
      context,
      summary: memoryContext.summary || 'None yet — this is a new conversation.',
      memory: memoryBlock || 'None recorded.',
      history,
      question: request.message,
    });

    await this.historyStore.appendTurn(
      sessionId,
      new HumanMessage(request.message),
      new AIMessage(response.text),
    );
    this.extractSemanticMemoryInBackground(sessionId, request.message, response.text);

    return {
      sessionId,
      reply: response.text,
      model: env.GROQ_MODEL,
      citations: this.toCitations(chunks),
      retrieval,
      memory: this.buildMemoryInfo(history, budgetPlan, memoryContext),
      ...(response.usage_metadata ? { usage: response.usage_metadata } : {}),
    };
  }

  public async *stream({
    message,
    sessionId,
    retrievalOptions,
    options,
  }: {
    message: string;
    sessionId?: string;
    retrievalOptions?: RetrievalOptions;
    options?: StreamOptions;
  }): AsyncIterable<StreamChunk> {
    const sid = sessionId ?? randomUUID();

    const [{ chunks, retrieval }, memoryContext] = await Promise.all([
      this.retrieve(message, retrievalOptions ?? {}),
      this.prepareMemoryContext(sid, message),
    ]);

    const citations = this.toCitations(chunks);

    yield { type: 'citations', sessionId: sid, citations, retrieval };

    const context = this.buildContext(chunks);
    const memoryBlock = this.buildMemoryBlock(memoryContext.semanticFacts);
    const budgetPlan = this.computeBudget(context, memoryContext.summary, memoryBlock, message);
    const history = await trimHistory(memoryContext.rawMessages, budgetPlan.historyBudgetTokens);

    let fullText = '';
    let aggregated: AIMessage | undefined;

    const streamIterable = await this.chain.stream(
      {
        context,
        summary: memoryContext.summary || 'None yet — this is a new conversation.',
        memory: memoryBlock || 'None recorded.',
        history,
        question: message,
      },
      options?.signal ? { signal: options.signal } : {},
    );

    for await (const part of streamIterable) {
      aggregated = aggregated ? concat(aggregated, part) : part;

      if (part.text) {
        fullText += part.text;
        yield { type: 'token', sessionId: sid, text: part.text };
      }
    }

    await this.historyStore.appendTurn(sid, new HumanMessage(message), new AIMessage(fullText));
    this.extractSemanticMemoryInBackground(sid, message, fullText);

    yield {
      type: 'done',
      sessionId: sid,
      model: env.GROQ_MODEL,
      memory: this.buildMemoryInfo(history, budgetPlan, memoryContext),
      ...(aggregated?.usage_metadata ? { usage: aggregated.usage_metadata } : {}),
    };
  }

  private async retrieve(
    query: string,
    options: RetrievalOptions,
  ): Promise<{ chunks: RetrievedChunk[]; retrieval: RetrievalInfo }> {
    const result = await this.retrievalPipeline.retrieve(query, options);

    return {
      chunks: result.chunks,
      retrieval: { strategy: result.strategyUsed, stages: result.stages },
    };
  }

  private buildContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant context was found in the knowledge base.';
    }

    return chunks
      .map((chunk, i) => `[${i + 1}] (source: ${chunk.source})\n${chunk.content}`)
      .join('\n\n');
  }

  private toCitations(chunks: RetrievedChunk[]): ChatCitation[] {
    return chunks.map((chunk, i) => ({
      index: i + 1,
      source: chunk.source,
      ...(chunk.title ? { title: chunk.title } : {}),
      score: chunk.score,
      snippet: chunk.content.length > 200 ? `${chunk.content.slice(0, 200)}…` : chunk.content,
      content: chunk.content,
      ...(chunk.category ? { category: chunk.category } : {}),
      ...(chunk.docType ? { docType: chunk.docType } : {}),
    }));
  }

  /**
   * Loads a session's memory and, if §5's trigger fires, folds the oldest
   * messages into the rolling summary and compacts them out of Redis —
   * *before* this turn's retrieval/generation, so the check is always
   * based on history as of the *previous* turn (docs/phases/phase-3-memory.md §5).
   */
  private async prepareMemoryContext(sessionId: string, question: string): Promise<MemoryContext> {
    const { messages, summary: storedSummary } = await this.historyStore.load(sessionId);

    let summary = storedSummary;
    let summarized = false;
    let rawMessages = messages;

    if (
      messages.length > env.MEMORY_RECENT_MESSAGES_KEPT &&
      countMessageTokens(messages) > env.MEMORY_SUMMARY_TRIGGER_TOKENS
    ) {
      const cutoffIndex = messages.length - env.MEMORY_RECENT_MESSAGES_KEPT;
      const toSummarize = messages.slice(0, cutoffIndex);
      const toKeep = messages.slice(cutoffIndex);

      summary = await summarizeHistory(this.chatModel, storedSummary, toSummarize);
      await this.historyStore.compact(sessionId, env.MEMORY_RECENT_MESSAGES_KEPT, summary);

      rawMessages = toKeep;
      summarized = true;
    }

    const semanticFacts = this.semanticMemoryStore
      ? await this.semanticMemoryStore.search(sessionId, question)
      : [];

    return { rawMessages, summary, summarized, semanticFacts };
  }

  private computeBudget(
    context: string,
    summary: string,
    memoryBlock: string,
    question: string,
  ): TokenBudgetPlan {
    return computeHistoryBudget({
      systemPromptTokens: SYSTEM_PROMPT_STATIC_TOKENS,
      context,
      summary,
      memory: memoryBlock,
      question,
    });
  }

  private buildMemoryBlock(facts: readonly SemanticFact[]): string {
    if (facts.length === 0) {
      return '';
    }

    return facts.map((fact) => `- ${fact.text}`).join('\n');
  }

  private buildMemoryInfo(
    history: BaseMessage[],
    budgetPlan: TokenBudgetPlan,
    memoryContext: MemoryContext,
  ): MemoryInfo {
    const historyTokensUsed = countMessageTokens(history);

    return {
      historyMessageCount: history.length,
      historyTokens: historyTokensUsed,
      summarized: memoryContext.summarized,
      ...(memoryContext.summary ? { summary: memoryContext.summary } : {}),
      tokenBudget: { ...budgetPlan, historyTokensUsed },
      semanticFacts: memoryContext.semanticFacts,
    };
  }

  /**
   * Fact extraction (§7.1) runs *after* the turn's response is already
   * being returned/streamed — deliberately not awaited, so an extra LLM
   * call for a feature that's off by default never adds latency to the
   * chat response itself. Failures are logged, never surfaced to the client.
   */
  private extractSemanticMemoryInBackground(
    sessionId: string,
    question: string,
    reply: string,
  ): void {
    const store = this.semanticMemoryStore;
    if (!store) {
      return;
    }

    extractMemoryFacts(this.chatModel, question, reply)
      .then((facts) => store.save(sessionId, facts))
      .catch((error: unknown) => {
        logger.error({ error, sessionId }, 'Semantic memory fact extraction failed');
      });
  }
}

interface RetrievalOptionsSource {
  retrievalStrategy?: string | undefined;
  filters?: RetrievalOptions['filter'] | undefined;
  useMmr?: boolean | undefined;
  useRerank?: boolean | undefined;
  useCompression?: boolean | undefined;
  useQueryExpansion?: boolean | undefined;
}

/**
 * Maps the wire-level chat request fields (shared between the JSON body and
 * the SSE query string) onto the retrieval pipeline's option shape.
 */
export function toRetrievalOptions(request: RetrievalOptionsSource): RetrievalOptions {
  return {
    ...(request.retrievalStrategy
      ? { strategy: request.retrievalStrategy as RetrievalStrategy }
      : {}),
    ...(request.filters ? { filter: request.filters } : {}),
    ...(request.useMmr !== undefined ? { useMmr: request.useMmr } : {}),
    ...(request.useRerank !== undefined ? { useRerank: request.useRerank } : {}),
    ...(request.useCompression !== undefined ? { useCompression: request.useCompression } : {}),
    ...(request.useQueryExpansion !== undefined
      ? { useQueryExpansion: request.useQueryExpansion }
      : {}),
  };
}
