import { TextChunker } from '@/ai/knowledge/chunker/text-chunker.js';
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
    const chunker = new TextChunker();

    let totalChunks = 0;

    for (const document of documents) {
      const chunks = await chunker.chunk(document);

      totalChunks += chunks.length;

      console.log(`\n📄 ${document.title}`);
      console.log(`   ${chunks.length} chunk(s)`);

      for (const chunk of chunks) {
        console.log(`      [${chunk.index}] ${chunk.content.length} chars`);
      }
    }

    console.log(`\n✅ Loaded ${documents.length} document(s)`);
    console.log(`✅ Generated ${totalChunks} chunk(s)`);
  }
}
