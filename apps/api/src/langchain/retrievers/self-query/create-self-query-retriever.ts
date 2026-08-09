import { SelfQueryRetriever } from '@langchain/classic/retrievers/self_query';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { QdrantVectorStore } from '@langchain/qdrant';

import { env } from '@/config/env.js';

import type { RetrievedChunk, Retriever } from '../retriever.types.js';
import { toRetrievedChunk, withScore } from '../to-retrieved-chunk.js';
import { KNOWLEDGE_ATTRIBUTE_INFO, KNOWLEDGE_DOCUMENT_CONTENTS } from './attribute-info.js';
import { QdrantTranslator } from './qdrant-translator.js';

export interface CreateSelfQueryRetrieverOptions {
  vectorStore: QdrantVectorStore;
  llm: BaseChatModel;
}

/**
 * Self-query retriever — the LLM turns a natural-language question into a
 * *structured* query: a semantic search string plus a metadata filter
 * (e.g. "refund policy for electronics" → query: "refund policy", filter:
 * category = "retail"). The filter is applied server-side by Qdrant via
 * `QdrantTranslator`; the (possibly rewritten) semantic query string still
 * drives the vector search.
 *
 * Note: `SelfQueryRetriever` retrieves via `vectorStore.asRetriever()`,
 * which doesn't surface similarity scores in this LangChain.js version —
 * so results here get a rank-based placeholder score (1.0 = best), not a
 * comparable cosine similarity. Documented in `docs/phases/phase-2-advanced-rag.md`.
 */
export function createSelfQueryRetriever(options: CreateSelfQueryRetrieverOptions): Retriever {
  const retriever = SelfQueryRetriever.fromLLM({
    llm: options.llm,
    vectorStore: options.vectorStore,
    documentContents: KNOWLEDGE_DOCUMENT_CONTENTS,
    attributeInfo: KNOWLEDGE_ATTRIBUTE_INFO,
    structuredQueryTranslator: new QdrantTranslator(),
    searchParams: { k: env.RETRIEVAL_TOP_K },
  });

  return {
    async retrieve(query: string): Promise<RetrievedChunk[]> {
      const documents = await retriever.invoke(query);
      const total = Math.max(documents.length, 1);

      return documents.map((document, index) =>
        toRetrievedChunk(withScore(document, 1 - index / total)),
      );
    },
  };
}
