export interface VectorPoint {
  id: string;
  vector: readonly number[];
  payload: Record<string, unknown>;
}

export interface VectorStore {
  createCollection(collection: string, dimensions: number): Promise<void>;

  upsert(collection: string, points: readonly VectorPoint[]): Promise<void>;
}
