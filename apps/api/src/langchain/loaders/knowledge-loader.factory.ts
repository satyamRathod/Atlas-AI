import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';

import { env } from '@/config/env.js';

export function createKnowledgeLoader(): DirectoryLoader {
  return new DirectoryLoader(env.KNOWLEDGE_DIRECTORY, {
    '.md': (path: string) => new TextLoader(path),
  });
}
