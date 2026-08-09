import { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { env } from '@/config/env.js';
import { applyPostRetrievalStages } from '@/langchain/retrievers/create-compression-retriever.js';
import type { RetrievedChunk, Retriever } from '@/langchain/retrievers/retriever.types.js';
import { toRetrievedChunk } from '@/langchain/retrievers/to-retrieved-chunk.js';

import { expandQuery } from '../query/expand-query.js';
import type {
  AdvancedRetrieveOptions,
  RetrievalStageTiming,
  RetrievalStrategy,
} from './retrieval-strategy.js';

export interface AdvancedRetrieveResult {
  chunks: RetrievedChunk[];
  strategyUsed: RetrievalStrategy;
  effectiveQuery: string;
  stages: RetrievalStageTiming[];
}

export interface RetrievalPipeline {
  retrieve(query: string, options?: AdvancedRetrieveOptions): Promise<AdvancedRetrieveResult>;
}

export interface CreateAdvancedRetrieverOptions {
  denseRetriever: Retriever;
  hybridRetriever: Retriever;
  mmrRetriever: Retriever;
  multiQueryRetriever: Retriever;
  selfQueryRetriever: Retriever;
  parentDocumentRetriever: Retriever;
  chatModel: BaseChatModel;
  embeddings: Embeddings;
}

/**
 * The Phase 2 strategy composer. Picks a base retrieval strategy (request
 * override, falling back to `RETRIEVAL_STRATEGY`), optionally rewrites the
 * query first (query expansion), runs the base strategy, then optionally
 * layers cross-encoder reranking and/or context compression on top —
 * regardless of which base strategy produced the candidates. See
 * `docs/phases/phase-2-advanced-rag.md` for the full pipeline diagram.
 *
 * Always returns the app's stable `RetrievedChunk[]` shape, so
 * `ChatService` and citations don't need to know which strategy ran.
 */
export function createAdvancedRetriever(deps: CreateAdvancedRetrieverOptions): RetrievalPipeline {
  return {
    async retrieve(
      query: string,
      options: AdvancedRetrieveOptions = {},
    ): Promise<AdvancedRetrieveResult> {
      const strategy = options.strategy ?? env.RETRIEVAL_STRATEGY;
      const useMmr =
        options.useMmr ??
        (strategy === 'dense' || strategy === 'hybrid' ? env.RETRIEVAL_MMR_ENABLED : false);
      const useRerank = options.useRerank ?? env.RETRIEVAL_RERANK_ENABLED;
      const useCompression = options.useCompression ?? env.RETRIEVAL_COMPRESSION_ENABLED;
      const useQueryExpansion =
        options.useQueryExpansion ??
        (env.RETRIEVAL_QUERY_EXPANSION_ENABLED && (strategy === 'dense' || strategy === 'hybrid'));

      const stages: RetrievalStageTiming[] = [];
      let effectiveQuery = query;

      if (useQueryExpansion) {
        effectiveQuery = await timed(stages, 'query_expansion', () =>
          expandQuery(deps.chatModel, query),
        );
      }

      let chunks = await timed(stages, retrievalStageName(strategy, useMmr), () =>
        runBaseStrategy(deps, strategy, useMmr, effectiveQuery, options.filter),
      );

      if (useRerank || useCompression) {
        const documents = chunks.map(chunkToDocument);
        const compressed = await timed(
          stages,
          postRetrievalStageName(useRerank, useCompression),
          () =>
            applyPostRetrievalStages({
              documents,
              query: effectiveQuery,
              embeddings: deps.embeddings,
              useRerank,
              useCompression,
            }),
        );
        chunks = compressed.map(toRetrievedChunk);
      }

      return { chunks, strategyUsed: strategy, effectiveQuery, stages };
    },
  };
}

async function runBaseStrategy(
  deps: CreateAdvancedRetrieverOptions,
  strategy: RetrievalStrategy,
  useMmr: boolean,
  query: string,
  filter: AdvancedRetrieveOptions['filter'],
): Promise<RetrievedChunk[]> {
  if ((strategy === 'dense' || strategy === 'hybrid') && useMmr) {
    return deps.mmrRetriever.retrieve(query, { filter });
  }

  switch (strategy) {
    case 'dense':
      return deps.denseRetriever.retrieve(query, { filter });
    case 'hybrid':
      return deps.hybridRetriever.retrieve(query, { filter });
    case 'multi_query':
      return deps.multiQueryRetriever.retrieve(query, { filter });
    case 'self_query':
      return deps.selfQueryRetriever.retrieve(query);
    case 'parent_document':
      return deps.parentDocumentRetriever.retrieve(query);
    default: {
      const unsupported: never = strategy;
      throw new Error(`Unsupported retrieval strategy: ${unsupported}`);
    }
  }
}

function retrievalStageName(strategy: RetrievalStrategy, useMmr: boolean): string {
  return (strategy === 'dense' || strategy === 'hybrid') && useMmr ? 'mmr' : strategy;
}

function postRetrievalStageName(useRerank: boolean, useCompression: boolean): string {
  if (useRerank && useCompression) return 'rerank+compression';
  return useRerank ? 'rerank' : 'compression';
}

function chunkToDocument(chunk: RetrievedChunk): Document {
  return new Document({
    pageContent: chunk.content,
    metadata: {
      source: chunk.source,
      title: chunk.title,
      score: chunk.score,
      category: chunk.category,
      docType: chunk.docType,
    },
  });
}

async function timed<T>(
  stages: RetrievalStageTiming[],
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  stages.push({ name, durationMs: Math.round(performance.now() - start) });
  return result;
}
