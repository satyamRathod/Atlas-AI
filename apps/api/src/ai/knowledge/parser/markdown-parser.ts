import { createHash } from 'node:crypto';

import matter from 'gray-matter';

import type { DocumentMetadata, KnowledgeDocument, RawDocument } from '../models/index.js';

/**
 * Converts a raw markdown document into a structured knowledge document.
 */
export class MarkdownParser {
  /**
   * Parse markdown and extract frontmatter.
   */
  public parse(document: RawDocument): KnowledgeDocument {
    const parsed = matter(document.content);

    const metadata: DocumentMetadata = {
      tags: Array.isArray(parsed.data.tags)
        ? parsed.data.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
    };

    if (typeof parsed.data.author === 'string') {
      metadata.author = parsed.data.author;
    }

    if (typeof parsed.data.category === 'string') {
      metadata.category = parsed.data.category;
    }

    if (parsed.data.createdAt) {
      metadata.createdAt = new Date(parsed.data.createdAt);
    }

    if (parsed.data.updatedAt) {
      metadata.updatedAt = new Date(parsed.data.updatedAt);
    }

    return {
      id: createHash('sha256').update(document.source).digest('hex'),

      source: document.source,

      title:
        typeof parsed.data.title === 'string'
          ? parsed.data.title
          : this.extractTitle(document.source),

      content: parsed.content.trim(),

      metadata,
    };
  }

  /**
   * Creates a readable title from the filename if
   * no title exists in frontmatter.
   */
  private extractTitle(source: string): string {
    return source.split('/').pop()?.replace('.md', '').replace(/[-_]/g, ' ') ?? '';
  }
}
