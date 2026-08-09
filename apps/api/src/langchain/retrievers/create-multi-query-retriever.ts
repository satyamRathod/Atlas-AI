import { MultiQueryRetriever } from '@langchain/classic/retrievers/multi_query';
import { Document } from '@langchain/core/documents';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { env } from '@/config/env.js';

import { FunctionRetriever } from './function-retriever.js';
import type {
  MetadataFilter,
  RetrievedChunk,
  RetrieveOptions,
  Retriever,
} from './retriever.types.js';
import { toRetrievedChunk } from './to-retrieved-chunk.js';

export interface CreateMultiQueryRetrieverOptions {
  baseRetriever: Retriever;
  llm: BaseChatModel;
  queryCount?: number;
}

/**
 * Multi-query retrieval — asks the LLM to rewrite the question into several
 * phrasings, retrieves for each with the given base retriever (typically
 * hybrid search), and merges/dedupes the results. Improves recall for
 * ambiguous or underspecified queries where a single retrieval pass might
 * miss the intended matches.
 */
export function createMultiQueryRetriever(options: CreateMultiQueryRetrieverOptions): Retriever {
  return {
    async retrieve(query: string, retrieveOptions?: RetrieveOptions): Promise<RetrievedChunk[]> {
      const filter: MetadataFilter | undefined = retrieveOptions?.filter;

      // Bridges our app-level Retriever (RetrievedChunk[]) back into the
      // Document[] world MultiQueryRetriever expects, so each generated
      // query variant still goes through the real hybrid/dense pipeline.
      const wrappedBaseRetriever = new FunctionRetriever({
        getRelevantDocuments: async (variantQuery: string) => {
          const chunks = await options.baseRetriever.retrieve(variantQuery, { filter });

          return chunks.map(
            (chunk) =>
              new Document({
                pageContent: chunk.content,
                metadata: {
                  source: chunk.source,
                  title: chunk.title,
                  score: chunk.score,
                  category: chunk.category,
                  docType: chunk.docType,
                },
              }),
          );
        },
      });

      const multiQueryRetriever = MultiQueryRetriever.fromLLM({
        retriever: wrappedBaseRetriever,
        llm: options.llm,
        queryCount: options.queryCount ?? env.RETRIEVAL_MULTI_QUERY_COUNT,
      });

      const documents = await multiQueryRetriever.invoke(query);

      return documents
        .slice()
        .sort((a, b) => Number(b.metadata.score ?? 0) - Number(a.metadata.score ?? 0))
        .slice(0, env.RETRIEVAL_TOP_K)
        .map(toRetrievedChunk);
    },
  };
}
