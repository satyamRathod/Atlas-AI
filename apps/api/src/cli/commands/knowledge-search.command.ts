import { env } from '@/config/env.js';
import { createEmbeddings } from '@/langchain/embeddings/index.js';
import { createQdrantVectorStore } from '@/langchain/vectorstores/index.js';

import type { Command } from '../command.js';

/**
 * Demonstrates the native `vectorStore.asRetriever()` contract (a
 * `BaseRetriever` Runnable) as a quick, server-less way to sanity check
 * retrieval quality. The HTTP chat flow uses `similaritySearchWithScore`
 * directly instead, since it needs scores for citations.
 */
export class KnowledgeSearchCommand implements Command {
  public readonly name = 'knowledge:search';
  public readonly description = 'Search the indexed knowledge base for a query (via asRetriever())';

  public async execute(args: string[]): Promise<void> {
    const query = args
      .filter((arg) => !arg.startsWith('--'))
      .join(' ')
      .trim();

    if (!query) {
      console.log('Usage: pnpm ai knowledge:search "<query>"');
      return;
    }

    console.log(`🔎 Searching knowledge base for: "${query}"\n`);

    const embeddings = createEmbeddings();
    const vectorStore = await createQdrantVectorStore({ embeddings });
    const retriever = vectorStore.asRetriever(env.RETRIEVAL_TOP_K);

    const documents = await retriever.invoke(query);

    if (documents.length === 0) {
      console.log('No results found.');
      return;
    }

    documents.forEach((document, i) => {
      const title = document.metadata.title ? ` — ${document.metadata.title}` : '';
      console.log(`[${i + 1}] source: ${document.metadata.source}${title}`);
      console.log(document.pageContent.slice(0, 300).trim());
      console.log('');
    });
  }
}
