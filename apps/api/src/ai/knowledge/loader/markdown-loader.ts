import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PATHS } from '../../../config/paths.js';
import type { LoadedDocument } from './types.js';

export class MarkdownLoader {
  private readonly knowledgeDirectory = PATHS.knowledge;

  async loadDocuments(): Promise<LoadedDocument[]> {
    const entries = await fs.readdir(this.knowledgeDirectory);

    const markdownFiles = entries.filter((file) => file.endsWith('.md'));

    const documents = await Promise.all(
      markdownFiles.map(async (file) => {
        const filePath = path.join(this.knowledgeDirectory, file);

        const content = await fs.readFile(filePath, 'utf8');

        return {
          id: randomUUID(),
          source: file,
          title: path.basename(file, '.md'),
          content,
        };
      }),
    );

    return documents;
  }
}
