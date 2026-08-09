import type { CallbackManagerForRetrieverRun } from '@langchain/core/callbacks/manager';
import type { Document } from '@langchain/core/documents';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';

export interface FunctionRetrieverOptions extends BaseRetrieverInput {
  getRelevantDocuments: (query: string) => Promise<Document[]>;
}

/**
 * Adapts an arbitrary `(query) => Promise<Document[]>` function into a real
 * `BaseRetriever`. This is the bridge between our app-level retrieval
 * pipeline (which passes plain `Document[]` between stages) and LangChain
 * classes that expect a `BaseRetriever` (`MultiQueryRetriever`,
 * `ContextualCompressionRetriever`), so we can use those classes directly
 * instead of re-implementing their logic.
 */
export class FunctionRetriever extends BaseRetriever {
  static override lc_name() {
    return 'FunctionRetriever';
  }

  lc_namespace = ['atlas', 'retrievers', 'function'];

  private readonly getDocuments: (query: string) => Promise<Document[]>;

  constructor(options: FunctionRetrieverOptions) {
    super(options);
    this.getDocuments = options.getRelevantDocuments;
  }

  public override async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun,
  ): Promise<Document[]> {
    return this.getDocuments(query);
  }
}
