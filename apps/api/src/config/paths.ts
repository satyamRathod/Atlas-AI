import { existsSync } from 'node:fs';
import path from 'node:path';

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;

  while (true) {
    // pnpm-workspace.yaml is the root marker
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      throw new Error('Unable to locate workspace root.');
    }

    current = parent;
  }
}

export const PATHS = {
  workspaceRoot: findWorkspaceRoot(import.meta.dirname),
  get knowledge() {
    return path.join(this.workspaceRoot, 'knowledge');
  },
} as const;
