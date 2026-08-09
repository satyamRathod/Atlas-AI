import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from '@huggingface/transformers';
import { BaseDocumentCompressor } from '@langchain/classic/retrievers/document_compressors';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import { Document, type DocumentInterface } from '@langchain/core/documents';

export interface CrossEncoderRerankerOptions {
  model: string;
  topN?: number;
}

interface SequenceClassifierLogits {
  logits: { data: ArrayLike<number> };
}

/**
 * Cross-encoder reranking — scores each (query, chunk) pair *jointly*
 * through a single small transformer, instead of comparing independently
 * computed embeddings (bi-encoder / dense search). This is slower (one
 * forward pass per candidate instead of a single vector comparison) but
 * far more precise, so it's applied only to the top handful of already-
 * retrieved candidates, not the whole corpus.
 *
 * Runs locally via Transformers.js — no external reranking API/key needed,
 * consistent with the local embeddings model. Deliberately bypasses
 * `pipeline("text-classification", ...)`: MS MARCO MiniLM rerankers publish
 * a single-logit regression head, and that pipeline applies softmax, which
 * collapses a single logit to a constant `1.0` for every candidate. Using
 * `AutoTokenizer` + `AutoModelForSequenceClassification` directly (per the
 * model card) gives the raw, comparable relevance logits.
 */
export class CrossEncoderReranker extends BaseDocumentCompressor {
  private readonly modelName: string;
  private readonly topN: number;
  private modelPromise?: Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }>;

  constructor(options: CrossEncoderRerankerOptions) {
    super();
    this.modelName = options.model;
    this.topN = options.topN ?? 4;
  }

  private loadModel(): Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> {
    if (!this.modelPromise) {
      this.modelPromise = Promise.all([
        AutoTokenizer.from_pretrained(this.modelName),
        AutoModelForSequenceClassification.from_pretrained(this.modelName),
      ]).then(([tokenizer, model]) => ({ tokenizer, model }));
    }

    return this.modelPromise;
  }

  public async compressDocuments(
    documents: DocumentInterface[],
    query: string,
    _callbacks?: Callbacks,
  ): Promise<DocumentInterface[]> {
    if (documents.length === 0) {
      return [];
    }

    const { tokenizer, model } = await this.loadModel();

    const inputs = tokenizer(
      documents.map(() => query),
      {
        text_pair: documents.map((document) => document.pageContent),
        padding: true,
        truncation: true,
      },
    );

    const output = (await model(inputs)) as unknown as SequenceClassifierLogits;
    const scores = Array.from(output.logits.data);

    return documents
      .map((document, index) => ({ document, score: scores[index] ?? Number.NEGATIVE_INFINITY }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topN)
      .map(
        ({ document, score }) =>
          new Document({
            pageContent: document.pageContent,
            metadata: { ...document.metadata, score },
          }),
      );
  }
}
