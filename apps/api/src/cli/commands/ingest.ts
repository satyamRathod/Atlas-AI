import { buildCli } from '../cli.factory.js';
import type { Command } from '../command.js';

export class IngestCommand implements Command {
  readonly name = 'ingest';

  readonly description = 'Load markdown knowledge';

  public async execute(): Promise<void> {
    console.log('📚 Atlas AI Ingestion\n');

    const cli = buildCli();
    const vectors = await cli.embeddingService.embed([
      {
        id: '1',
        index: 0,
        content: 'JWT tokens are used for authentication.',
        metadata: {},
        source: 'test',
        documentId: '1',
      },
    ]);

    console.log(vectors[0]?.vector.length);
    console.log(vectors[0]?.vector.slice(0, 10));

    const rawDocuments = await cli.loader.loadDocuments();

    const documents = rawDocuments.map((document) => cli.parser.parse(document));

    let totalChunks = 0;

    for (const document of documents) {
      const chunks = await cli.chunker.chunk(document);

      totalChunks += chunks.length;

      const embeddings = await cli.embeddingService.embed(chunks);

      console.log(`\n📄 ${document.title}`);
      console.log(`   ${chunks.length} chunk(s)`);

      for (const embedding of embeddings) {
        console.log(`\n   Chunk ${embedding.input.index}`);
        console.log(`   Characters : ${embedding.input.content.length}`);
        console.log(`   Dimensions : ${embedding.vector.length}`);

        const preview = embedding.vector
          .slice(0, 5)
          .map((value) => value.toFixed(6))
          .join(', ');

        console.log(`   Preview    : [${preview} ...]`);
      }
    }

    console.log(`\n✅ Loaded ${documents.length} document(s)`);
    console.log(`✅ Generated ${totalChunks} chunk(s)`);
  }
}
