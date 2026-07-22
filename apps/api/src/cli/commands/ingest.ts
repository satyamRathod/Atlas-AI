import { MarkdownLoader } from '@/ai/knowledge/loader/markdown-loader.js';
import { MarkdownParser } from '@/ai/knowledge/parser/markdown-parser.js';
import type { Command } from '../command.js';

export class IngestCommand implements Command {
  readonly name = 'ingest';

  readonly description = 'Load markdown knowledge';

  async execute(): Promise<void> {
    console.log('📚 Atlas AI Ingestion\n');

    const loader = new MarkdownLoader();

    const parser = new MarkdownParser();

    const rawDocuments = await loader.loadDocuments();

    const documents = rawDocuments.map((document) => parser.parse(document));

    console.log(`✓ Loaded ${documents.length} documents\n`);

    for (const doc of documents) {
      console.log(`• ${doc.source}`);
    }
  }
}
