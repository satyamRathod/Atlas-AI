import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { env } from '@/config/env.js';

export function createTextSplitter(): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter({
    chunkSize: env.TEXT_CHUNK_SIZE,
    chunkOverlap: env.TEXT_CHUNK_OVERLAP,
  });
}
