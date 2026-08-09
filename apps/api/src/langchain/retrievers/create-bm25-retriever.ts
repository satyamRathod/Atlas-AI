import { loadBm25Corpus } from './bm25-corpus-store.js';
import { Bm25Retriever } from './bm25-retriever.js';

/**
 * Builds a BM25 retriever from the corpus `knowledge:index` persisted to
 * Redis (see `bm25-corpus-store.ts`) — the same chunks that were embedded
 * into Qdrant, rather than re-reading and re-splitting `knowledge/*.md`.
 * This keeps BM25 aligned with the dense index and mirrors how the Qdrant
 * retriever works: indexing is a separate, explicit step (`knowledge:index`),
 * and boot/query time only ever *reads* the already-built index.
 */
export async function createBm25Retriever(k?: number): Promise<Bm25Retriever> {
  const chunks = await loadBm25Corpus();

  if (!chunks) {
    throw new Error(
      'BM25 corpus not found in Redis. Run `pnpm ai knowledge:index` to build it before starting the server or searching.',
    );
  }

  return Bm25Retriever.fromDocuments(chunks, k !== undefined ? { k } : {});
}
