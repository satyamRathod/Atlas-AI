import { Info, RotateCcw, Wrench } from 'lucide-react';
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
 * Tools settings bar (Phase 5 UI) — mirrors `PromptSettingsBar`'s layout: a
 * master `Switch` for `useTools`, plus one `Switch` row per registered tool
 * (fetched from `GET /api/v1/tools`) so `enabledTools` never hardcodes tool
 * names client-side.
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
            {settings.useTools && tools.length > 0 && (
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

        {settings.useTools && (
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
