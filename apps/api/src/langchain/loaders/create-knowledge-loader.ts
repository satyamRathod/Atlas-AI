import path from 'node:path';

import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import type { Document } from '@langchain/core/documents';

import { env } from '@/config/env.js';

const HEADING_PATTERN = /^#\s+(.+)$/m;

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
 * Enriches loader output with a `title` and a `source` relative to the
 * knowledge directory, which keeps citations short and portable.
 */
function enrichMetadata(documents: Document[]): Document[] {
  return documents.map((document) => {
    const absoluteSource = String(document.metadata.source ?? '');
    const relativeSource = absoluteSource
      ? path.relative(env.KNOWLEDGE_DIRECTORY, absoluteSource)
      : 'unknown';

    return {
      ...document,
      metadata: {
        ...document.metadata,
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
