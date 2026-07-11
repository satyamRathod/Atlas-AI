import type { GenerateRequest } from '../types/generate-request.js';
import type { GenerateResponse } from '../types/generate-response.js';

export interface LLMProvider {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
