import {
  BaseTranslator,
  type Comparator,
  Comparators,
  type Comparison,
  type Operation,
  type Operator,
  Operators,
  type StructuredQuery,
} from '@langchain/core/structured_query';
import type { QdrantVectorStore } from '@langchain/qdrant';

type QdrantCondition = Record<string, unknown>;

/**
 * Compiles LangChain's structured-query IR (produced by
 * `SelfQueryRetriever`'s LLM query constructor) into Qdrant's native filter
 * DSL (`must`/`should`/`must_not` with `{ key, match | range }` conditions).
 *
 * Neither `@langchain/classic` nor `@langchain/qdrant` ship a Qdrant
 * translator (unlike Pinecone/Weaviate/Chroma in the Python ecosystem), so
 * this fills that gap. Metadata is stored under the `metadata` payload key
 * by `@langchain/qdrant`, so every attribute is addressed as
 * `metadata.<attribute>`.
 */
export class QdrantTranslator extends BaseTranslator<QdrantVectorStore> {
  // `Operators`/`Comparators` are typed as index signatures upstream, so
  // property access reports `| undefined` under `noUncheckedIndexedAccess`
  // even though these keys always exist.
  allowedOperators: Operator[] = [Operators.and, Operators.or, Operators.not] as Operator[];

  allowedComparators: Comparator[] = [
    Comparators.eq,
    Comparators.ne,
    Comparators.gt,
    Comparators.gte,
    Comparators.lt,
    Comparators.lte,
  ] as Comparator[];

  formatFunction(): string {
    // Qdrant's filter shape is structural (must/should/match/range), not a
    // single operator-name string like Mongo's `$eq` — so there's nothing
    // to format. `visitComparison`/`visitOperation` build the filter directly.
    throw new Error('QdrantTranslator builds filters structurally; formatFunction is unused.');
  }

  visitComparison(comparison: Comparison): QdrantCondition {
    const key = `metadata.${comparison.attribute}`;

    switch (comparison.comparator) {
      case Comparators.eq:
        return { key, match: { value: comparison.value } };
      case Comparators.ne:
        return { must_not: [{ key, match: { value: comparison.value } }] };
      case Comparators.gt:
        return { key, range: { gt: comparison.value } };
      case Comparators.gte:
        return { key, range: { gte: comparison.value } };
      case Comparators.lt:
        return { key, range: { lt: comparison.value } };
      case Comparators.lte:
        return { key, range: { lte: comparison.value } };
      default:
        throw new Error(`Unsupported comparator for Qdrant: ${comparison.comparator}`);
    }
  }

  visitOperation(operation: Operation): QdrantCondition {
    const args = (operation.args ?? []).map((arg) => arg.accept(this) as QdrantCondition);

    switch (operation.operator) {
      case Operators.and:
        return { must: args };
      case Operators.or:
        return { should: args };
      case Operators.not:
        return { must_not: args };
      default:
        throw new Error(`Unsupported operator for Qdrant: ${operation.operator}`);
    }
  }

  visitStructuredQuery(query: StructuredQuery): { filter?: QdrantVectorStore['FilterType'] } {
    if (!query.filter) {
      return {};
    }

    const condition = query.filter.accept(this) as QdrantCondition;

    // A bare comparison (e.g. `category = "hr"` with no boolean operator)
    // isn't already shaped as must/should/must_not — normalize it into one.
    const isAlreadyClause = 'must' in condition || 'should' in condition || 'must_not' in condition;

    return {
      filter: (isAlreadyClause
        ? condition
        : { must: [condition] }) as QdrantVectorStore['FilterType'],
    };
  }

  mergeFilters(
    defaultFilter: QdrantVectorStore['FilterType'] | undefined,
    generatedFilter: QdrantVectorStore['FilterType'] | undefined,
    mergeType: 'and' | 'or' | 'replace' = 'and',
    forceDefaultFilter = false,
  ): QdrantVectorStore['FilterType'] | undefined {
    if (forceDefaultFilter) {
      return defaultFilter;
    }

    if (!defaultFilter) {
      return generatedFilter;
    }

    if (!generatedFilter) {
      return defaultFilter;
    }

    if (mergeType === 'replace') {
      return generatedFilter;
    }

    if (mergeType === 'or') {
      return { should: [defaultFilter, generatedFilter] } as QdrantVectorStore['FilterType'];
    }

    return { must: [defaultFilter, generatedFilter] } as QdrantVectorStore['FilterType'];
  }
}
