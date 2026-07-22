import fs from 'node:fs/promises';
import path from 'node:path';

import { PATHS } from '@/config/paths.js';

import type { RawDocument } from '../models/index.js';

/**
 * Loads markdown files from the knowledge directory.
 */
export class MarkdownLoader {
  /**
   * Load all markdown documents.
   */
  public async loadDocuments(): Promise<RawDocument[]> {
    const entries = await fs.readdir(PATHS.knowledge);

    const markdownFiles = entries.filter((file) => file.endsWith('.md'));

    return Promise.all(
      markdownFiles.map(async (file) => {
        const absolutePath = path.join(PATHS.knowledge, file);

        return {
          source: `knowledge/${file}`,
          path: absolutePath,
          content: await fs.readFile(absolutePath, 'utf8'),
        };
      }),
    );
  }
}
