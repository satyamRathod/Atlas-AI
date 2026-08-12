import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { env } from '@/config/env.js';
import type { RetrievalPipeline } from '@/langchain/retrieval/index.js';

import type { RegisteredTool } from './tool.types.js';

const NAME = 'file_search';
const DESCRIPTION =
  'Searches the knowledge base for content relevant to a query and returns matching excerpts. ' +
  'Use this to look something up again with a different or more specific query than the ' +
  'question already provided — the initial context may not cover every angle.';

const schema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      'A focused search query for the knowledge base, not necessarily the original question verbatim.',
    ),
});

type FileSearchArgs = z.infer<typeof schema>;

/**
 * Wraps the same `RetrievalPipeline` (Phase 1/2) that already builds every
 * turn's always-on context — but as a tool the model can *choose* to call
 * again with a refined query, distinct from that always-on injection which
 * keeps happening unchanged regardless of `useTools` (§2 of
 * docs/phases/phase-5-tools.md).
 */
export function createFileSearchTool(retrievalPipeline: RetrievalPipeline): RegisteredTool {
  async function execute({ query }: FileSearchArgs): Promise<{
    results: { index: number; source: string; title?: string; score: number; snippet: string }[];
  }> {
    const { chunks } = await retrievalPipeline.retrieve(query, { strategy: 'dense' });
    const topChunks = chunks.slice(0, env.TOOLS_FILE_SEARCH_TOP_K);

    return {
      results: topChunks.map((chunk, i) => ({
        index: i + 1,
        source: chunk.source,
        ...(chunk.title ? { title: chunk.title } : {}),
        score: chunk.score,
        snippet: chunk.content.length > 500 ? `${chunk.content.slice(0, 500)}…` : chunk.content,
      })),
    };
  }

  return {
    name: NAME,
    description: DESCRIPTION,
    schema,
    execute,
    structuredTool: tool(execute, { name: NAME, description: DESCRIPTION, schema }),
  } as unknown as RegisteredTool;
}
