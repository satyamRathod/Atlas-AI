import { MarkdownLoader } from '@/ai/knowledge/loader/index.js';

export async function ingestCommand() {
  console.log('📚 Atlas AI Ingestion\n');

  const loader = new MarkdownLoader();

  const documents = await loader.loadDocuments();

  console.log(`✓ Loaded ${documents.length} documents\n`);

  for (const document of documents) {
    console.log(`• ${document.source}`);
  }
}
