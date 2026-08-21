import type { Edge, Node } from '@xyflow/react';
import { Background, Handle, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch } from 'lucide-react';
import { useMemo } from 'react';

import { useGraphDefinition } from '@/hooks/use-graph-definition';
import { cn } from '@/lib/utils';
import type { GraphNodeDisplay } from '@/types/chat';

interface GraphVisualizationProps {
  nodes?: readonly GraphNodeDisplay[];
  /** Which entry in `nodes` to highlight as "current" — defaults to the last one (the live/most-recently-reached node) when omitted, which is what `GraphExecutionReplay`'s scrubber overrides. */
  activeIndex?: number;
}

/** Fixed positions for the Phase 7 graph's five nodes (§1 of docs/phases/phase-7-langgraph.md) — small and unchanging, so no auto-layout library is needed (per the plan). */
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  __start__: { x: 190, y: 0 },
  human_approval: { x: 0, y: 100 },
  agent: { x: 190, y: 100 },
  tools: { x: 380, y: 100 },
  __end__: { x: 190, y: 210 },
};

const NODE_LABELS: Record<string, string> = {
  __start__: 'START',
  human_approval: 'human_approval',
  agent: 'agent',
  tools: 'tools',
  __end__: 'END',
};

type NodeStatus = GraphNodeDisplay['status'] | 'visited' | 'idle';

const STATUS_STYLES: Record<NodeStatus, string> = {
  idle: 'border-border bg-card text-muted-foreground',
  visited: 'border-muted-foreground/40 bg-muted/60 text-foreground',
  running: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400 animate-pulse',
  success: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  error: 'border-destructive bg-destructive/10 text-destructive',
  interrupted: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

function GraphFlowNode({ data }: { data: { label: string; status: NodeStatus } }) {
  return (
    <div
      className={cn(
        'rounded-md border-2 px-3 py-1.5 text-center text-[11px] font-medium shadow-sm transition-colors',
        STATUS_STYLES[data.status],
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!size-1.5" />
      <Handle type="target" position={Position.Left} className="!size-1.5" />
      <Handle type="source" position={Position.Right} className="!size-1.5" />
    </div>
  );
}

const NODE_TYPES = { graphNode: GraphFlowNode };

/**
 * Graph visualization (Phase 7 UI) — renders the compiled graph's static
 * topology (fetched once from `GET /api/v1/graph` via `useGraphDefinition()`)
 * with React Flow, highlighting whichever node `activeIndex` points at in
 * `nodes` (live during streaming, or a scrubbed-to step from
 * `GraphExecutionReplay`). Every node this turn already passed through
 * gets a dimmer "visited" ring so the taken path is visible at a glance,
 * not just the current step.
 */
export function GraphVisualization({ nodes, activeIndex }: GraphVisualizationProps) {
  const { definition, error } = useGraphDefinition();

  const resolvedIndex = activeIndex ?? (nodes && nodes.length > 0 ? nodes.length - 1 : undefined);
  const current = resolvedIndex !== undefined ? nodes?.[resolvedIndex] : undefined;
  const visitedIds = useMemo(() => {
    if (!nodes || resolvedIndex === undefined) return new Set<string>();
    return new Set(nodes.slice(0, resolvedIndex + 1).map((node) => node.nodeId));
  }, [nodes, resolvedIndex]);

  const flowNodes = useMemo<Node[]>(() => {
    if (!definition) return [];

    return definition.nodes.map((node): Node => {
      const status: NodeStatus =
        node.id === current?.nodeId ? current.status : visitedIds.has(node.id) ? 'visited' : 'idle';

      return {
        id: node.id,
        type: 'graphNode',
        position: NODE_POSITIONS[node.id] ?? { x: 190, y: 100 },
        data: { label: NODE_LABELS[node.id] ?? node.name, status },
        draggable: false,
        selectable: false,
      };
    });
  }, [definition, current, visitedIds]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!definition) return [];

    return definition.edges.map(
      (edge): Edge => ({
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: edge.conditional,
        style: edge.conditional ? { strokeDasharray: '4 3' } : undefined,
      }),
    );
  }, [definition]);

  if (!nodes || nodes.length === 0) return null;

  if (error) {
    return <p className="text-muted-foreground text-xs">Could not load the graph topology.</p>;
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <GitBranch className="size-3.5" />
        Graph
      </span>
      <div className="bg-card h-64 w-full overflow-hidden rounded-lg border">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
        >
          <Background gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
