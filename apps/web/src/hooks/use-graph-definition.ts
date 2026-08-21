import { useEffect, useState } from 'react';

import { type GraphDefinition, getGraphDefinition } from '@/lib/api';

/** Every message's `GraphVisualization` shares this graph — the compiled topology is fixed at server boot, so one fetch (module-level, not per-component) covers the whole session. */
let definitionPromise: Promise<GraphDefinition> | undefined;

/** Fetches the static graph topology (`GET /api/v1/graph`) once per page load, regardless of how many `GraphVisualization` instances mount. */
export function useGraphDefinition() {
  const [definition, setDefinition] = useState<GraphDefinition | undefined>();
  const [error, setError] = useState(false);

  useEffect(() => {
    definitionPromise ??= getGraphDefinition();
    definitionPromise.then(setDefinition).catch(() => setError(true));
  }, []);

  return { definition, error };
}
