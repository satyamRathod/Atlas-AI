import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import type { CompiledMultiAgentGraph } from '@/langchain/multi-agent/index.js';

const threadIdParamSchema = z.object({
  threadId: z.string().trim().min(1, 'threadId is required'),
});

/**
 * Read-only introspection for the Phase 8 supervisor graph (§4 of
 * docs/phases/phase-8-multi-agent.md) — mirrors `modules/graph/graph.controller.ts`
 * from Phase 7, with one deliberate difference: Phase 7 keys state by the
 * bare chat `sessionId` (its `messages` state is meant to grow across
 * turns), but Phase 8's blackboard is scoped to a single turn, so
 * `MultiAgentRunner` mints a fresh `magent:{sessionId}:{uuid}` thread per
 * turn instead. `state()` below therefore takes that full thread id
 * (as returned in `MultiAgentRunInfo.threadId`) rather than re-deriving it
 * from a bare session id.
 */
export class MultiAgentController {
  constructor(private readonly compiledGraph: CompiledMultiAgentGraph) {}

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

  public state: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { threadId } = threadIdParamSchema.parse(req.params);

    const checkpoints: Array<{
      checkpointId?: string;
      next: readonly string[];
      createdAt?: string;
      roundCount: number;
      planLength: number;
      researchNoteCount: number;
      draftCount: number;
      reviewCount: number;
    }> = [];

    for await (const snapshot of this.compiledGraph.getStateHistory({
      configurable: { thread_id: threadId },
    })) {
      const values = snapshot.values as {
        roundCount?: number;
        plan?: unknown[];
        researchNotes?: unknown[];
        draftHistory?: unknown[];
        reviewHistory?: unknown[];
      };
      const checkpointId = (snapshot.config.configurable as Record<string, unknown> | undefined)
        ?.checkpoint_id as string | undefined;

      checkpoints.push({
        ...(checkpointId ? { checkpointId } : {}),
        next: snapshot.next,
        ...(snapshot.createdAt ? { createdAt: snapshot.createdAt } : {}),
        roundCount: values.roundCount ?? 0,
        planLength: values.plan?.length ?? 0,
        researchNoteCount: values.researchNotes?.length ?? 0,
        draftCount: values.draftHistory?.length ?? 0,
        reviewCount: values.reviewHistory?.length ?? 0,
      });
    }

    res.status(200).json({ threadId, checkpoints });
  };
}
