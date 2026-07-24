import { Workflow } from '@/ai/workflows/workflow.js';
import type { WorkflowContext } from '@/ai/workflows/workflow-context.js';
import type { TextChunker } from '../chunker/text-chunker.js';
import type { MarkdownLoader } from '../loader/markdown-loader.js';
import type { DocumentChunk } from '../models/document-chunk.js';
import type { KnowledgeDocument } from '../models/knowledge-document.js';
import type { MarkdownParser } from '../parser/markdown-parser.js';
import type { KnowledgeIngestionResult } from './knowledge-ingestion-result.js';

/**
 * Orchestrates knowledge ingestion.
 */
export class KnowledgeIngestionWorkflow extends Workflow<
  WorkflowContext,
  KnowledgeIngestionResult
> {
  constructor(
    private readonly loader: MarkdownLoader,
    private readonly parser: MarkdownParser,
    private readonly chunker: TextChunker,
  ) {
    super();
  }

  public async execute(_context: WorkflowContext): Promise<KnowledgeIngestionResult> {
    const rawDocuments = await this.loader.loadDocuments();

    const documents: KnowledgeDocument[] = rawDocuments.map((document) =>
      this.parser.parse(document),
    );

    const chunks: DocumentChunk[] = [];

    for (const document of documents) {
      const documentChunks = await this.chunker.chunk(document);

      chunks.push(...documentChunks);
    }

    return {
      documents,
      chunks,
      embeddings: [],
    };
  }
}
