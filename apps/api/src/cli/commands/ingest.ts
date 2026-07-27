import { toVectorPoint } from '@/ai/vector-store/vector-point.mapper.js';
import { env } from '@/config/env.js';
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

    let collectionCreated = false;

    for (const document of documents) {
      const chunks = await cli.chunker.chunk(document);

      totalChunks += chunks.length;

      const embeddings = await cli.embeddingService.embed(chunks);

      if (!collectionCreated) {
        await cli.vectorStore.createCollection(
          env.QDRANT_COLLECTION,
          embeddings[0]?.vector?.length ?? 0,
        );

        collectionCreated = true;
      }

      await cli.vectorStore.upsert(env.QDRANT_COLLECTION, embeddings.map(toVectorPoint));

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
