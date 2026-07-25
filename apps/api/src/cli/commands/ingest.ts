import { buildCli } from '../cli.factory.js';
import type { Command } from '../command.js';

export class IngestCommand implements Command {
  readonly name = 'ingest';

  readonly description = 'Load markdown knowledge';

  public async execute(): Promise<void> {
    console.log('📚 Atlas AI Ingestion\n');

    const cli = buildCli();

    const rawDocuments = await cli.loader.loadDocuments();

    const documents = rawDocuments.map((document) => cli.parser.parse(document));

    let totalChunks = 0;

    for (const document of documents) {
      const chunks = await cli.chunker.chunk(document);

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
