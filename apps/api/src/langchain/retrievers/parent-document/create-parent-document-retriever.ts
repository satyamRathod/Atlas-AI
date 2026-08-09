import { ParentDocumentRetriever } from '@langchain/classic/retrievers/parent_document';
import type { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import { InMemoryStore } from '@langchain/core/stores';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

import { env } from '@/config/env.js';
import { embeddingConfiguration } from '@/langchain/embeddings/index.js';
import { loadKnowledgeDocuments } from '@/langchain/loaders/index.js';
import {
  createQdrantVectorStore,
  QdrantCollectionService,
} from '@/langchain/vectorstores/index.js';

import type { RetrievedChunk, Retriever } from '../retriever.types.js';
import { toRetrievedChunk, withScore } from '../to-retrieved-chunk.js';
import { loadParentDocstore, saveParentDocstore } from './parent-docstore-store.js';

export interface BuildParentDocumentRetrieverOptions {
  embeddings: Embeddings;
  reset?: boolean;
}

function createSplitters() {
  return {
    parentSplitter: new RecursiveCharacterTextSplitter({
      chunkSize: env.PARENT_CHUNK_SIZE,
      chunkOverlap: env.PARENT_CHUNK_OVERLAP,
    }),
    childSplitter: new RecursiveCharacterTextSplitter({
      chunkSize: env.CHILD_CHUNK_SIZE,
      chunkOverlap: env.CHILD_CHUNK_OVERLAP,
    }),
  };
}

/**
 * **Ingestion only** — called exclusively by
 * `knowledge:index --target=parent-child` (never at app boot; see
 * `connectParentDocumentRetriever` below). (Re)builds the parent-document
 * index: small child chunks are embedded into a dedicated Qdrant collection
 * (`KNOWLEDGE_PARENT_COLLECTION`) for precise matching, while full parent
 * documents are persisted to Redis (`saveParentDocstore`), keyed by a
 * generated `doc_id`. On retrieval, a match on a child chunk resolves back
 * to its larger parent document — trading precise matching (small chunks)
 * for richer generation context (large parents).
 *
 * A separate collection is used (instead of reusing `QDRANT_COLLECTION`) so
 * the flat dense/hybrid baseline from Phase 1 is unaffected.
 */
export async function buildParentDocumentRetriever(
  options: BuildParentDocumentRetrieverOptions,
): Promise<ParentDocumentRetriever> {
  const collections = new QdrantCollectionService();

  if (options.reset) {
    await collections.recreateCollection(
      env.KNOWLEDGE_PARENT_COLLECTION,
      embeddingConfiguration.dimensions,
    );
  } else {
    await collections.ensureCollection({
      name: env.KNOWLEDGE_PARENT_COLLECTION,
      dimensions: embeddingConfiguration.dimensions,
    });
  }

  const vectorstore = await createQdrantVectorStore({
    embeddings: options.embeddings,
    collectionName: env.KNOWLEDGE_PARENT_COLLECTION,
  });

  const docstore = new InMemoryStore<Document>();
  const retriever = new ParentDocumentRetriever({
    vectorstore,
    docstore,
    ...createSplitters(),
    childK: env.RETRIEVAL_FETCH_K,
    parentK: env.RETRIEVAL_TOP_K,
  });

  const documents = await loadKnowledgeDocuments();
  await retriever.addDocuments(documents);

  await saveParentDocstore(docstore);

  return retriever;
}

export interface ConnectParentDocumentRetrieverOptions {
  embeddings: Embeddings;
}

/**
 * **Boot/query time only** — reads the parent-document index that
 * `knowledge:index --target=parent-child` already built, rather than
 * rebuilding it. Loads the parent docstore snapshot from Redis and connects
 * to the already-populated child-chunk Qdrant collection; never calls
 * `addDocuments` (no splitting/embedding happens here). Mirrors how
 * `createBm25Retriever`/`createRetriever` only ever *connect to* an
 * already-built index.
 *
 * Throws if the Redis snapshot is missing — i.e. `knowledge:index
 * --target=parent-child` hasn't been run yet.
 */
export async function connectParentDocumentRetriever(
  options: ConnectParentDocumentRetrieverOptions,
): Promise<ParentDocumentRetriever> {
  const docstore = await loadParentDocstore();

  if (!docstore) {
    throw new Error(
      'Parent-document docstore not found in Redis. Run `pnpm ai knowledge:index --target=parent-child` to build it before starting the server or searching.',
    );
  }

  const vectorstore = await createQdrantVectorStore({
    embeddings: options.embeddings,
    collectionName: env.KNOWLEDGE_PARENT_COLLECTION,
  });

  return new ParentDocumentRetriever({
    vectorstore,
    docstore,
    ...createSplitters(),
    childK: env.RETRIEVAL_FETCH_K,
    parentK: env.RETRIEVAL_TOP_K,
  });
}

/**
 * Adapts a `ParentDocumentRetriever` to our app-level `Retriever` contract.
 *
 * Note: it retrieves via the child vectorstore's `.similaritySearch` (no
 * scores in this LangChain.js version), so results get a rank-based
 * placeholder score (1.0 = best), not a comparable cosine similarity.
 */
export function toParentDocumentRetriever(retriever: ParentDocumentRetriever): Retriever {
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
