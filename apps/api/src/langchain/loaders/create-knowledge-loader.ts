import path from 'node:path';

import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import type { Document } from '@langchain/core/documents';

import { env } from '@/config/env.js';

const HEADING_PATTERN = /^#\s+(.+)$/m;

/**
 * Structured metadata per knowledge file, keyed by the `source` path
 * relative to `KNOWLEDGE_DIRECTORY`. This is what powers metadata filtering
 * and the self-query retriever (Phase 2) — without it, there is nothing
 * structured to filter on besides `source`/`title`.
 *
 * Unrecognized files fall back to `DEFAULT_DOCUMENT_METADATA` below, so
 * adding a new knowledge file never breaks indexing — it just won't be
 * filterable by `category`/`docType` until an entry is added here.
 */
const DOCUMENT_METADATA_BY_SOURCE: Record<string, { category: string; docType: string }> = {
  'employee-handbook.md': { category: 'hr', docType: 'policy' },
  'faq.md': { category: 'product', docType: 'faq' },
  'refund-policy.md': { category: 'retail', docType: 'policy' },
};

const DEFAULT_DOCUMENT_METADATA = { category: 'general', docType: 'document' };

/**
 * Derives a human-readable title from the first markdown heading, falling
 * back to the file name when no heading is present.
 */
function deriveTitle(content: string, source: string): string {
  const match = HEADING_PATTERN.exec(content);

  if (match?.[1]) {
    return match[1].trim();
  }

  return path.basename(source, path.extname(source));
}

/**
 * Enriches loader output with a `title`, a `source` relative to the
 * knowledge directory, and structured `category`/`docType` metadata used
 * for metadata filtering and self-query retrieval.
 */
function enrichMetadata(documents: Document[]): Document[] {
  return documents.map((document) => {
    const absoluteSource = String(document.metadata.source ?? '');
    const relativeSource = absoluteSource
      ? path.relative(env.KNOWLEDGE_DIRECTORY, absoluteSource)
      : 'unknown';
    const structuredMetadata =
      DOCUMENT_METADATA_BY_SOURCE[relativeSource] ?? DEFAULT_DOCUMENT_METADATA;

    return {
      ...document,
      metadata: {
        ...document.metadata,
        ...structuredMetadata,
        source: relativeSource,
        title: deriveTitle(document.pageContent, relativeSource),
      },
    };
  });
}

export function createKnowledgeLoader(): DirectoryLoader {
  return new DirectoryLoader(env.KNOWLEDGE_DIRECTORY, {
    '.md': (filePath: string) => new TextLoader(filePath),
  });
}

export async function loadKnowledgeDocuments(): Promise<Document[]> {
  const loader = createKnowledgeLoader();
  const documents = await loader.load();

  return enrichMetadata(documents);
}
