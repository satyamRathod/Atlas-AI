import { Kernel } from '@/ai/kernel/index.js';
import type { Command } from '../command.js';

export class IngestCommand implements Command {
  readonly name = 'ingest';

  readonly description = 'Load markdown knowledge';

  public async execute(): Promise<void> {
    console.log('📚 Atlas AI Ingestion\n');

    const kernel = new Kernel();

    const rawDocuments = await kernel.knowledge.loader.loadDocuments();

    const documents = rawDocuments.map((document) => kernel.knowledge.parser.parse(document));

    let totalChunks = 0;

    for (const document of documents) {
      const chunks = await kernel.knowledge.chunker.chunk(document);

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
