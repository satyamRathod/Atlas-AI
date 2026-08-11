import { Document } from '@langchain/core/documents';
import type { QdrantVectorStore } from '@langchain/qdrant';

import { env } from '@/config/env.js';
import { toQdrantFilter } from '@/langchain/retrieval/metadata-filter.js';

import type { SemanticFact } from '../memory.types.js';
import type { MemoryFactMetadata } from './semantic-memory.types.js';

/**
 * `save()`/`search()` over the semantic-memory collection (§7.2). Facts are
 * scoped to `sessionId` — there's no auth/user-identity system yet (Phase
 * 11), so this can't be scoped to a durable user across sessions today; the
 * metadata shape is deliberately `{ sessionId, createdAt }` so a `userId`
 * field can sit alongside it later without a schema migration.
 */
export class SemanticMemoryStore {
  constructor(private readonly vectorStore: QdrantVectorStore) {}

  public async save(sessionId: string, facts: readonly string[]): Promise<void> {
    if (facts.length === 0) {
      return;
    }

    const documents = facts.map((text) => {
      const metadata: MemoryFactMetadata = { sessionId, createdAt: new Date().toISOString() };
      return new Document({ pageContent: text, metadata });
    });

    await this.vectorStore.addDocuments(documents);
  }

  /**
   * Facts relevant to `query`, scoped to `sessionId`, above
   * `MEMORY_SEMANTIC_SCORE_THRESHOLD` — never a citation-worthy chunk, just
   * context for `{memory}` in the system prompt (§8).
   */
  public async search(sessionId: string, query: string): Promise<SemanticFact[]> {
    const filter = toQdrantFilter({ sessionId });

    const results = await this.vectorStore.similaritySearchWithScore(
      query,
      env.MEMORY_SEMANTIC_TOP_K,
      filter,
    );

    return results
      .filter(([, score]) => score >= env.MEMORY_SEMANTIC_SCORE_THRESHOLD)
      .map(([document, score]) => ({ text: document.pageContent, score }));
  }
}
