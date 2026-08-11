import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { TokenBudgetInfo } from '@/types/chat';

interface TokenBudgetPanelProps {
  tokenBudget: TokenBudgetInfo;
}

interface BudgetSegment {
  key: string;
  label: string;
  tokens: number;
  barColor: string;
  dotColor: string;
}

function formatTokens(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString();
}

/** Splits the model's full context window into the same four buckets §3/§4 of phase-3-memory.md reason about. */
function buildSegments(budget: TokenBudgetInfo): BudgetSegment[] {
  const used = budget.promptOverheadTokens + budget.historyTokensUsed + budget.reservedOutputTokens;
  const free = Math.max(0, budget.maxContextTokens - used);

  return [
    {
      key: 'overhead',
      label: 'Prompt overhead',
      tokens: budget.promptOverheadTokens,
      barColor: 'bg-violet-500',
      dotColor: 'bg-violet-500',
    },
    {
      key: 'history',
      label: 'History (this turn)',
      tokens: budget.historyTokensUsed,
      barColor: 'bg-primary',
      dotColor: 'bg-primary',
    },
    {
      key: 'reserved',
      label: 'Reserved for reply',
      tokens: budget.reservedOutputTokens,
      barColor: 'bg-amber-500',
      dotColor: 'bg-amber-500',
    },
    {
      key: 'free',
      label: 'Unused headroom',
      tokens: free,
      barColor: 'bg-muted',
      dotColor: 'bg-muted-foreground/30',
    },
  ];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Context window visualization + token budget panel (Phase 3 UI), both
 * built from the same `tokenBudget` numbers the chat API returns
 * (`MemoryInfo.tokenBudget`, docs/phases/phase-3-memory.md §3/§8): a
 * proportional bar showing how the model's full context window is carved
 * up this turn, plus the underlying budgeting math (max context, reserved
 * output, prompt overhead, and the history ceiling vs. what was actually
 * used) that decided it.
 *
 * Segment widths use `flexGrow` with a small `minWidth` floor so tiny but
 * non-zero segments (prompt overhead is typically a few hundred tokens
 * against a 100k+ window) stay visible instead of rounding to nothing —
 * the exact counts are always in the legend/stats below, the bar is
 * intentionally approximate.
 */
export function TokenBudgetPanel({ tokenBudget }: TokenBudgetPanelProps) {
  const segments = buildSegments(tokenBudget);
  const historyUtilization =
    tokenBudget.historyBudgetTokens > 0
      ? Math.min(
          100,
          Math.round((tokenBudget.historyTokensUsed / tokenBudget.historyBudgetTokens) * 100),
        )
      : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="text-muted-foreground text-xs font-medium">Context window</div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full border">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className={segment.barColor}
              style={{
                flexGrow: Math.max(segment.tokens, 0.0001),
                flexBasis: 0,
                minWidth: segment.tokens > 0 ? '4px' : 0,
              }}
              title={`${segment.label} — ${formatTokens(segment.tokens)} tok`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {segments.map((segment) => (
            <div key={segment.key} className="flex items-center gap-1.5 text-xs">
              <span className={cn('size-2 shrink-0 rounded-full', segment.dotColor)} />
              <span className="text-muted-foreground truncate">{segment.label}</span>
              <span className="ml-auto font-mono tabular-nums">{formatTokens(segment.tokens)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-muted/30 grid grid-cols-2 gap-2.5 rounded-md border p-2.5 text-xs sm:grid-cols-4">
        <Stat label="Max context" value={`${formatTokens(tokenBudget.maxContextTokens)} tok`} />
        <Stat
          label="Reserved output"
          value={`${formatTokens(tokenBudget.reservedOutputTokens)} tok`}
        />
        <Stat
          label="Prompt overhead"
          value={`${formatTokens(tokenBudget.promptOverheadTokens)} tok`}
        />
        <Stat
          label="History budget"
          value={`${formatTokens(tokenBudget.historyBudgetTokens)} tok`}
        />
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">History used vs. budget</span>
            <span className="font-mono tabular-nums">
              {formatTokens(tokenBudget.historyTokensUsed)} /{' '}
              {formatTokens(tokenBudget.historyBudgetTokens)} tok ({historyUtilization}%)
            </span>
          </div>
          <Progress
            value={historyUtilization}
            className="h-1.5"
            indicatorClassName={historyUtilization >= 80 ? 'bg-amber-500' : undefined}
          />
        </div>
      </div>
    </div>
  );
}
