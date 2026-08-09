import { AttributeInfo } from '@langchain/classic/chains/query_constructor';

/** Mirrors `DOCUMENT_METADATA_BY_SOURCE` in `langchain/loaders/create-knowledge-loader.ts`. */
export const KNOWLEDGE_DOCUMENT_CONTENTS =
  'Internal company knowledge base articles covering HR policy, product FAQs, and retail policies.';

export const KNOWLEDGE_ATTRIBUTE_INFO: AttributeInfo[] = [
  new AttributeInfo(
    'category',
    'string',
    'The topical category of the document. One of "hr", "product", "retail", or "general".',
  ),
  new AttributeInfo(
    'docType',
    'string',
    'The type of document. One of "policy", "faq", or "document".',
  ),
  new AttributeInfo(
    'source',
    'string',
    'The knowledge base file name the chunk came from, e.g. "faq.md".',
  ),
];
