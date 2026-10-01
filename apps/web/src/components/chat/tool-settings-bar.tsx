import { GitBranch, Info, RotateCcw, Sparkles, Users, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { listTools } from '@/lib/tools-api';
import type { ToolDefinition, ToolSettings } from '@/types/chat';

interface ToolSettingsBarProps {
  settings: ToolSettings;
  onUpdate: (patch: Partial<ToolSettings>) => void;
  onReset: () => void;
}

/** `enabledTools: []` means "every registered tool" — the same "empty means all" convention the backend's `enabledTools` request field uses. */
function isToolEnabled(settings: ToolSettings, toolName: string): boolean {
  return settings.enabledTools.length === 0 || settings.enabledTools.includes(toolName);
}

function toggleTool(
  settings: ToolSettings,
  allNames: string[],
  toolName: string,
  checked: boolean,
): string[] {
  const currentlyEnabled = allNames.filter((name) => isToolEnabled(settings, name));
  const next = checked
    ? Array.from(new Set([...currentlyEnabled, toolName]))
    : currentlyEnabled.filter((name) => name !== toolName);

  // Collapse back to [] once every known tool is enabled again, so the
  // wire form stays "omit the field" instead of listing every name.
  return next.length === allNames.length ? [] : next;
}

/**
 * Tools settings bar (Phase 5 UI, extended for Phase 6, 7, and 8) — a
 * master `Switch` for `useTools` (native tool-calling), a second master
 * `Switch` for `useAgent` (the classic text-based ReAct loop), a third for
 * `useGraph` (the LangGraph `StateGraph` with a human-approval gate), and
 * a fourth for `useMultiAgent` (the supervisor graph — coordinator routing
 * between planner/researcher/writer/reviewer), sharing one set of per-tool
 * `Switch` rows below (fetched from `GET /api/v1/tools`) so `enabledTools`
 * never hardcodes tool names client-side and doesn't need a fourth,
 * duplicate settings bar. `enabledTools` scopes which tools the
 * `researcher` specialist may call when `useMultiAgent` is on.
 */
export function ToolSettingsBar({ settings, onUpdate, onReset }: ToolSettingsBarProps) {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    listTools()
      .then((list) => {
        setTools(list);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, []);

  const allNames = tools.map((tool) => tool.name);
  const enabledCount = allNames.filter((name) => isToolEnabled(settings, name)).length;
  const showToolRows =
    settings.useTools || settings.useAgent || settings.useGraph || settings.useMultiAgent;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="bg-card flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Tools</span>
            <Switch
              checked={settings.useTools}
              onCheckedChange={(checked) => onUpdate({ useTools: checked })}
            />
            {showToolRows && tools.length > 0 && (
              <Badge variant="outline" className="font-mono">
                {enabledCount}/{tools.length} enabled
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground max-w-sm flex-1 text-xs leading-relaxed">
            {loadError
              ? 'Could not load tools from the server.'
              : 'Let the model call tools (calculator, weather, file search, order lookup, datetime) mid-answer instead of answering from context alone.'}
          </p>

          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Agent mode (ReAct)</span>
            <Switch
              checked={settings.useAgent}
              onCheckedChange={(checked) => onUpdate({ useAgent: checked })}
            />
          </div>

          <p className="text-muted-foreground max-w-sm flex-1 text-xs leading-relaxed">
            Runs a classic Thought/Action/Observation reasoning loop instead of native tool-calling
            — uses the same tools below.
            {settings.useTools && settings.useAgent && ' Wins over "Tools" if both are on.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <GitBranch className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Graph mode (LangGraph)</span>
            <Switch
              checked={settings.useGraph}
              onCheckedChange={(checked) => onUpdate({ useGraph: checked })}
            />
          </div>

          <p className="text-muted-foreground max-w-sm flex-1 text-xs leading-relaxed">
            Runs the same tools through an explicit LangGraph{' '}
            <code className="text-[11px]">StateGraph</code> — sensitive calls (order lookup) pause
            for human approval and every step is checkpointed to Redis.
            {(settings.useTools || settings.useAgent) &&
              settings.useGraph &&
              ' Wins over "Tools" and "Agent mode" if either is also on.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Multi-agent mode</span>
            <Switch
              checked={settings.useMultiAgent}
              onCheckedChange={(checked) => onUpdate({ useMultiAgent: checked })}
            />
          </div>

          <p className="text-muted-foreground max-w-sm flex-1 text-xs leading-relaxed">
            Routes through a coordinator that dispatches to planner/researcher/writer/reviewer
            specialists instead of one agent — the researcher uses the tools below.
            {(settings.useTools || settings.useAgent || settings.useGraph) &&
              settings.useMultiAgent &&
              ' Wins over "Tools", "Agent mode", and "Graph mode" if any is also on.'}
          </p>
        </div>

        {showToolRows && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tools.map((tool) => {
              const inputId = `tool-toggle-${tool.name}`;
              const checked = isToolEnabled(settings, tool.name);

              return (
                <div
                  key={tool.name}
                  className="bg-muted/30 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <label htmlFor={inputId} className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono text-sm">{tool.name}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="text-muted-foreground size-3.5 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>{tool.description}</TooltipContent>
                    </Tooltip>
                  </label>
                  <Switch
                    id={inputId}
                    checked={checked}
                    onCheckedChange={(next) =>
                      onUpdate({ enabledTools: toggleTool(settings, allNames, tool.name, next) })
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
