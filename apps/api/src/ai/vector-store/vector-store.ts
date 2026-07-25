export interface VectorStore {
  createCollection(collection: string, dimensions: number): Promise<void>;
}
