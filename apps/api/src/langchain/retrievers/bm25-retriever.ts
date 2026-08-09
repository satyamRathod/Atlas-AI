import type { CallbackManagerForRetrieverRun } from '@langchain/core/callbacks/manager';
import { Document } from '@langchain/core/documents';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';

export interface Bm25RetrieverOptions extends BaseRetrieverInput {
  documents: Document[];
  k?: number;
  /** Term-frequency saturation. Higher = additional occurrences of a term keep mattering longer. */
  k1?: number;
  /** Length normalization strength, 0 (none) to 1 (full). */
  b?: number;
}

interface Bm25IndexEntry {
  document: Document;
  termFrequencies: Map<string, number>;
  length: number;
}

const TOKEN_PATTERN = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

/**
 * Okapi BM25 — classic lexical (keyword) ranking. Scores each document by
 * term frequency (how often a query term appears), inverse document
 * frequency (how rare that term is across the corpus), and document length
 * normalization.
 *
 * This runs entirely in-process over documents passed at construction time
 * (see `create-bm25-retriever.ts` for how those are sourced) — there's no
 * external lexical index. See `docs/phases/phase-2-advanced-rag.md` for why:
 * `@langchain/qdrant` doesn't support Qdrant's native sparse vectors, and no
 * JS BM25 library exists to fill that gap the way Python's `fastembed` does.
 */
export class Bm25Retriever extends BaseRetriever {
  static override lc_name() {
    return 'Bm25Retriever';
  }

  lc_namespace = ['atlas', 'retrievers', 'bm25'];

  private readonly k: number;
  private readonly k1: number;
  private readonly b: number;
  private readonly index: Bm25IndexEntry[];
  private readonly documentFrequency: Map<string, number>;
  private readonly averageDocumentLength: number;
  private readonly totalDocuments: number;

  constructor(options: Bm25RetrieverOptions) {
    super(options);

    this.k = options.k ?? 4;
    this.k1 = options.k1 ?? 1.2;
    this.b = options.b ?? 0.75;

    this.index = options.documents.map((document) => {
      const tokens = tokenize(document.pageContent);
      const termFrequencies = new Map<string, number>();

      for (const token of tokens) {
        termFrequencies.set(token, (termFrequencies.get(token) ?? 0) + 1);
      }

      return { document, termFrequencies, length: tokens.length };
    });

    this.totalDocuments = this.index.length;
    this.averageDocumentLength =
      this.totalDocuments === 0
        ? 0
        : this.index.reduce((sum, entry) => sum + entry.length, 0) / this.totalDocuments;

    this.documentFrequency = new Map();
    for (const entry of this.index) {
      for (const term of entry.termFrequencies.keys()) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
      }
    }
  }

  static fromDocuments(
    documents: Document[],
    options: Omit<Bm25RetrieverOptions, 'documents'> = {},
  ): Bm25Retriever {
    return new Bm25Retriever({ ...options, documents });
  }

  private idf(term: string): number {
    const documentFrequency = this.documentFrequency.get(term) ?? 0;
    // +0.5/+1 smoothing keeps this finite and non-negative even for terms
    // that appear in most (or all) documents.
    return Math.log(
      1 + (this.totalDocuments - documentFrequency + 0.5) / (documentFrequency + 0.5),
    );
  }

  private score(queryTerms: string[], entry: Bm25IndexEntry): number {
    let score = 0;

    for (const term of queryTerms) {
      const termFrequency = entry.termFrequencies.get(term);

      if (!termFrequency) {
        continue;
      }

      const numerator = termFrequency * (this.k1 + 1);
      const denominator =
        termFrequency +
        this.k1 * (1 - this.b + (this.b * entry.length) / (this.averageDocumentLength || 1));

      score += this.idf(term) * (numerator / denominator);
    }

    return score;
  }

  public override async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun,
  ): Promise<Document[]> {
    const queryTerms = tokenize(query);

    if (queryTerms.length === 0 || this.index.length === 0) {
      return [];
    }

    return this.index
      .map((entry) => ({ entry, score: this.score(queryTerms, entry) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.k)
      .map(
        ({ entry, score }) =>
          new Document({
            pageContent: entry.document.pageContent,
            metadata: { ...entry.document.metadata, score },
          }),
      );
  }
}
