import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

export const PATHS = {
  projectRoot: PROJECT_ROOT,
  knowledge: path.join(PROJECT_ROOT, 'knowledge'),
} as const;
