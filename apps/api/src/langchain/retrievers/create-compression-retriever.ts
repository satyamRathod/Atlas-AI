import { ContextualCompressionRetriever } from '@langchain/classic/retrievers/contextual_compression';
import {
  type BaseDocumentCompressor,
  DocumentCompressorPipeline,
} from '@langchain/classic/retrievers/document_compressors';
import { EmbeddingsFilter } from '@langchain/classic/retrievers/document_compressors/embeddings_filter';
import type { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';

import { env } from '@/config/env.js';
import { CrossEncoderReranker } from '@/langchain/rerank/index.js';

import { FunctionRetriever } from './function-retriever.js';

export interface ApplyPostRetrievalStagesOptions {
  documents: Document[];
  query: string;
  embeddings: Embeddings;
  useRerank?: boolean;
  useCompression?: boolean;
}

/**
 * Applies cross-encoder reranking (§5) and/or context compression (§8) to
 * an already-retrieved candidate set, in that order — rerank first to get
 * the best ordering, then compression to drop anything still irrelevant.
 *
 * Implemented as a post-retrieval stage rather than wrapping a whole
 * `Retriever`, since this pipeline passes plain `Document[]` between
 * composable stages (see `create-advanced-retriever.ts`). A
 * `FunctionRetriever` "replays" the already-fetched documents so the real
 * `ContextualCompressionRetriever` can still be used as-is, instead of
 * reimplementing its logic.
 */
export async function applyPostRetrievalStages(
  options: ApplyPostRetrievalStagesOptions,
): Promise<Document[]> {
  const compressors: BaseDocumentCompressor[] = [];

  if (options.useRerank) {
    compressors.push(
      new CrossEncoderReranker({
        model: env.RETRIEVAL_RERANK_MODEL,
        topN: env.RETRIEVAL_RERANK_TOP_N,
      }),
    );
  }

  if (options.useCompression) {
    compressors.push(
      new EmbeddingsFilter({
        embeddings: options.embeddings,
        similarityThreshold: env.RETRIEVAL_COMPRESSION_SIMILARITY_THRESHOLD,
      }),
    );
  }

  if (compressors.length === 0) {
    return options.documents;
  }

  const retriever = new ContextualCompressionRetriever({
    baseCompressor: new DocumentCompressorPipeline({ transformers: compressors }),
    baseRetriever: new FunctionRetriever({
      getRelevantDocuments: async () => options.documents,
    }),
  });

  return retriever.invoke(options.query);
}
