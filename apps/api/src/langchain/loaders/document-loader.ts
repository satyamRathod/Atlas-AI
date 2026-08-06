import type { Document } from '@langchain/core/documents';

export interface DocumentLoader {
  load(): Promise<Document[]>;
}
