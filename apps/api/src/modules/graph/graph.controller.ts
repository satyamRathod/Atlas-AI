import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import type { CompiledAgentGraph } from '@/langchain/graph/index.js';

const sessionIdParamSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
});

/**
 * Read-only introspection over the compiled Phase 7 agent graph (§1/§5 of
 * docs/phases/phase-7-langgraph.md) — mirrors `modules/tools/`'s
 * "definitions come from code, not a database" shape. Powers the
 * frontend's static topology render (`GraphVisualization`) and the
 * checkpoint list behind the State Inspector / Execution Replay UIs.
 */
export class GraphController {
  constructor(private readonly compiledGraph: CompiledAgentGraph) {}

  /** `GET /api/v1/graph` — the graph's fixed topology, independent of any particular run. */
  public definition: RequestHandler = (_req: Request, res: Response): void => {
    const graph = this.compiledGraph.getGraph();

    res.status(200).json({
      nodes: Object.values(graph.nodes).map((node) => ({ id: node.id, name: node.name })),
      edges: graph.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        conditional: edge.conditional ?? false,
      })),
    });
  };

  /**
   * `GET /api/v1/graph/state/:sessionId` — the ordered checkpoint history
   * for one thread (the chat `sessionId`), newest first (LangGraph's own
   * `getStateHistory()` order) — every pause/resume/step this session's
   * graph has gone through, trimmed to what a state inspector needs.
   */
  public state: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = sessionIdParamSchema.parse(req.params);

    const checkpoints: Array<{
      checkpointId?: string;
      next: readonly string[];
      createdAt?: string;
      stepCount: number;
      messageCount: number;
      hasPendingApproval: boolean;
    }> = [];

    for await (const snapshot of this.compiledGraph.getStateHistory({
      configurable: { thread_id: sessionId },
    })) {
      const values = snapshot.values as {
        messages?: unknown[];
        stepCount?: number;
      };
      const checkpointId = (snapshot.config.configurable as Record<string, unknown> | undefined)
        ?.checkpoint_id as string | undefined;

      checkpoints.push({
        ...(checkpointId ? { checkpointId } : {}),
        next: snapshot.next,
        ...(snapshot.createdAt ? { createdAt: snapshot.createdAt } : {}),
        stepCount: values.stepCount ?? 0,
        messageCount: values.messages?.length ?? 0,
        hasPendingApproval: snapshot.next.includes('human_approval'),
      });
    }

    res.status(200).json({ sessionId, checkpoints });
  };
}
