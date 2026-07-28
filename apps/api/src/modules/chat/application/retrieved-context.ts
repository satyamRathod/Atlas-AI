export interface RetrievedChunk {
  source: string;
  index: number;
  score: number;
  content: string;
}

export interface RetrievedContext {
  chunks: readonly RetrievedChunk[];
}
