import { createChatModel } from '@/langchain/chat/index.js';
import { createEmbeddings } from '@/langchain/embeddings/index.js';
import type { RetrievalStrategy } from '@/langchain/retrieval/index.js';
import { createAdvancedRetriever, RETRIEVAL_STRATEGIES } from '@/langchain/retrieval/index.js';
import {
  connectParentDocumentRetriever,
  createBm25Retriever,
  createHybridRetriever,
  createMmrRetriever,
  createMultiQueryRetriever,
  createRetriever,
  createSelfQueryRetriever,
  toParentDocumentRetriever,
} from '@/langchain/retrievers/index.js';
import { createQdrantVectorStore } from '@/langchain/vectorstores/index.js';

import type { Command } from '../command.js';

/**
 * Exercises the full Phase 2 retrieval pipeline outside the HTTP server —
 * pass `--strategy=<dense|hybrid|multi_query|self_query|parent_document>`
 * (defaults to `RETRIEVAL_STRATEGY`), and any of `--mmr`, `--rerank`,
 * `--compression`, `--expand` to toggle the optional stages, for quick
 * side-by-side comparison across the knowledge base.
 */
export class KnowledgeSearchCommand implements Command {
  public readonly name = 'knowledge:search';
  public readonly description =
    'Search the knowledge base (--strategy=dense|hybrid|multi_query|self_query|parent_document, --mmr, --rerank, --compression, --expand)';

  public async execute(args: string[]): Promise<void> {
    const query = args
      .filter((arg) => !arg.startsWith('--'))
      .join(' ')
      .trim();

    if (!query) {
      console.log(
        'Usage: pnpm ai knowledge:search "<query>" [--strategy=dense|hybrid|multi_query|self_query|parent_document] [--mmr] [--rerank] [--compression] [--expand]',
      );
      return;
    }

    const strategyArg = args.find((arg) => arg.startsWith('--strategy='))?.split('=')[1];

    if (strategyArg && !RETRIEVAL_STRATEGIES.includes(strategyArg as RetrievalStrategy)) {
      console.log(
        `Unknown --strategy="${strategyArg}". Expected one of: ${RETRIEVAL_STRATEGIES.join(', ')}`,
      );
      return;
    }

    console.log(`🔎 Searching knowledge base for: "${query}"\n`);

    const chatModel = createChatModel();
    const embeddings = createEmbeddings();
    const vectorStore = await createQdrantVectorStore({ embeddings });

    const bm25Retriever = await createBm25Retriever();
    const denseRetriever = createRetriever(vectorStore);
    const hybridRetriever = createHybridRetriever({ vectorStore, bm25Retriever });
    const mmrRetriever = createMmrRetriever({ vectorStore });
    const multiQueryRetriever = createMultiQueryRetriever({
      baseRetriever: hybridRetriever,
      llm: chatModel,
    });
    const selfQueryRetriever = createSelfQueryRetriever({ vectorStore, llm: chatModel });
    const parentDocumentRetriever = toParentDocumentRetriever(
      await connectParentDocumentRetriever({ embeddings }),
    );

    const pipeline = createAdvancedRetriever({
      denseRetriever,
      hybridRetriever,
      mmrRetriever,
      multiQueryRetriever,
      selfQueryRetriever,
      parentDocumentRetriever,
      chatModel,
      embeddings,
    });

    const result = await pipeline.retrieve(query, {
      ...(strategyArg ? { strategy: strategyArg as RetrievalStrategy } : {}),
      useMmr: args.includes('--mmr'),
      useRerank: args.includes('--rerank'),
      useCompression: args.includes('--compression'),
      useQueryExpansion: args.includes('--expand'),
    });

    console.log(
      `Strategy: ${result.strategyUsed}${result.effectiveQuery !== query ? ` (expanded query: "${result.effectiveQuery}")` : ''}`,
    );
    console.log(
      `Stages: ${result.stages.map((stage) => `${stage.name} (${stage.durationMs}ms)`).join(' → ')}\n`,
    );

    if (result.chunks.length === 0) {
      console.log('No results found.');
      return;
    }

    result.chunks.forEach((chunk, i) => {
      const title = chunk.title ? ` — ${chunk.title}` : '';
      console.log(`[${i + 1}] source: ${chunk.source}${title} (score: ${chunk.score.toFixed(4)})`);
      console.log(chunk.content.slice(0, 300).trim());
      console.log('');
    });
  }
}
