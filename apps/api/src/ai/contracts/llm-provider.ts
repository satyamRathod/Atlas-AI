import type { GenerateRequest } from '../types/generate-request.js';
import type { GenerateResponse } from '../types/generate-response.js';
import type { StreamChunk } from '../types/stream-chunk.js';

export interface LLMProvider {
  generate(request: GenerateRequest): Promise<GenerateResponse>;

  stream(request: GenerateRequest): AsyncIterable<StreamChunk>;
}
