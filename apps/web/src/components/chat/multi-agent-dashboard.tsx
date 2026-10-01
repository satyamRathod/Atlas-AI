import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Compass,
  ListChecks,
  Loader2,
  PenLine,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AgentRole, MultiAgentTurnDisplay } from '@/types/chat';

interface MultiAgentDashboardProps {
  turns?: readonly MultiAgentTurnDisplay[];
}

/** Fixed left-to-right order the roadmap's "coordinator routes between specialists" wording implies — coordinator first, then the four specialists it dispatches to. */
const ROLES: readonly AgentRole[] = ['coordinator', 'planner', 'researcher', 'writer', 'reviewer'];

const ROLE_ICONS: Record<AgentRole, typeof Users> = {
  coordinator: Compass,
  planner: ListChecks,
  researcher: Search,
  writer: PenLine,
  reviewer: ClipboardCheck,
};

const ROLE_LABELS: Record<AgentRole, string> = {
  coordinator: 'Coordinator',
  planner: 'Planner',
  researcher: 'Researcher',
  writer: 'Writer',
  reviewer: 'Reviewer',
};

type RoleStatus = MultiAgentTurnDisplay['status'] | 'idle';

const STATUS_STYLES: Record<RoleStatus, string> = {
  idle: 'border-border bg-card text-muted-foreground',
  running: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  success: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  error: 'border-destructive bg-destructive/10 text-destructive',
};

function StatusIcon({ status }: { status: RoleStatus }) {
  if (status === 'success') return <CheckCircle2 className="size-3.5" />;
  if (status === 'error') return <XCircle className="size-3.5" />;
  if (status === 'running') return <Loader2 className="size-3.5 animate-spin" />;
  return null;
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

interface RoleSummary {
  role: AgentRole;
  status: RoleStatus;
  visits: number;
  lastDurationMs?: number;
}

/** One role's card in the scoreboard — its most recent visit's status/duration, plus how many times it's run so far this turn. */
function summarizeRoles(turns: readonly MultiAgentTurnDisplay[]): RoleSummary[] {
  return ROLES.map((role) => {
    const roleTurns = turns.filter((turn) => turn.role === role);
    const last = roleTurns.at(-1);
    return {
      role,
      status: last?.status ?? 'idle',
      visits: roleTurns.length,
      lastDurationMs: last?.durationMs,
    };
  });
}

function RoleCard({ summary }: { summary: RoleSummary }) {
  const Icon = ROLE_ICONS[summary.role];

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-md border-2 px-2.5 py-2 text-xs transition-colors',
        STATUS_STYLES[summary.status],
      )}
    >
      <span className="flex items-center gap-1.5 font-medium">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{ROLE_LABELS[summary.role]}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <StatusIcon status={summary.status} />
        <span className="capitalize">{summary.status}</span>
      </span>
      <span className="text-[11px] opacity-80">
        {summary.visits} visit{summary.visits === 1 ? '' : 's'}
        {summary.lastDurationMs !== undefined && ` · ${formatMs(summary.lastDurationMs)}`}
      </span>
    </div>
  );
}

/**
 * Multi-agent dashboard (Phase 8 UI) — the roadmap's **Multi-agent
 * dashboard** item: an at-a-glance scoreboard of all 5 roles (coordinator +
 * 4 specialists), each showing its current status and how many times it's
 * run so far this turn. Distinct from `AgentCommunicationTimeline` below,
 * which is chronological — this is a live-updating summary view, the
 * multi-agent analogue of `GraphVisualization`'s node-status board but
 * without needing a graph layout library (5 roles, one hub-and-spoke
 * shape, always the same 5 cards).
 *
 * Driven entirely by `message.agentTurns` (populated live via
 * `onAgentTurnStart`/`onAgentTurnEnd` in `use-chat.ts`) — no separate fetch
 * needed, unlike `GraphVisualization`'s static topology call.
 */
export function MultiAgentDashboard({ turns }: MultiAgentDashboardProps) {
  const [open, setOpen] = useState(true);

  if (!turns || turns.length === 0) return null;

  const summaries = summarizeRoles(turns);
  const runningCount = summaries.filter((summary) => summary.status === 'running').length;
  const errorCount = summaries.filter((summary) => summary.status === 'error').length;
  const totalVisits = turns.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Users className="size-3.5" />
        Multi-agent dashboard
        <Badge variant="outline" className="font-mono">
          {totalVisits} visit{totalVisits === 1 ? '' : 's'}
        </Badge>
        {runningCount > 0 && <Badge variant="secondary">{runningCount} running</Badge>}
        {errorCount > 0 && <Badge variant="destructive">{errorCount} failed</Badge>}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-5">
        {summaries.map((summary) => (
          <RoleCard key={summary.role} summary={summary} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
