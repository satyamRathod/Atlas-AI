import { Info, Pencil, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { PromptEditorDialog } from '@/components/chat/prompt-editor-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { listPromptTemplates } from '@/lib/prompts-api';
import type { PromptSettings, PromptTemplateSummary } from '@/types/chat';

interface PromptSettingsBarProps {
  settings: PromptSettings;
  onUpdate: (patch: Partial<PromptSettings>) => void;
  onReset: () => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const inputId = `prompt-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="bg-muted/30 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <label htmlFor={inputId} className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {label}
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{description}</TooltipContent>
          </Tooltip>
        </span>
      </label>
      <Switch id={inputId} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * Prompt settings bar (Phase 4 UI) — mirrors `RetrievalSettingsBar`'s
 * layout: a template/version `Select`, few-shot/structured-output
 * `Switch`es, and an "Edit" button opening `PromptEditorDialog` to save a
 * new template or version. Template list is fetched from
 * `GET /api/v1/prompts` on mount and re-fetched after a save.
 */
export function PromptSettingsBar({ settings, onUpdate, onReset }: PromptSettingsBarProps) {
  const [templates, setTemplates] = useState<PromptTemplateSummary[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listPromptTemplates();
      setTemplates(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = templates.find((t) => t.id === settings.templateId);
  const versionOptions = active
    ? Array.from({ length: active.versionCount }, (_, i) => i + 1).reverse()
    : [];
  const selectedVersion = settings.version ?? active?.latestVersion;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="bg-card flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">Prompt template</span>
            <Select
              value={settings.templateId}
              onValueChange={(value) => onUpdate({ templateId: value, version: undefined })}
            >
              <SelectTrigger size="sm" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">Version</span>
            <Select
              value={selectedVersion !== undefined ? String(selectedVersion) : undefined}
              onValueChange={(value) => onUpdate({ version: Number(value) })}
              disabled={versionOptions.length === 0}
            >
              <SelectTrigger size="sm" className="w-[100px]">
                <SelectValue placeholder="latest" />
              </SelectTrigger>
              <SelectContent>
                {versionOptions.map((version) => (
                  <SelectItem key={version} value={String(version)}>
                    v{version}
                    {version === active?.latestVersion ? ' (latest)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-muted-foreground max-w-xs flex-1 text-xs leading-relaxed">
            {loadError
              ? 'Could not load templates from the server.'
              : (active?.description ?? 'Which system prompt renders this turn.')}
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(true)}
              className="gap-1.5"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ToggleRow
            label="Few-shot"
            description="Splice this template's example input/output pairs into the prompt."
            checked={settings.useFewShot}
            onCheckedChange={(checked) => onUpdate({ useFewShot: checked })}
          />
          <ToggleRow
            label="Structured output"
            description="Ask the model for a validated JSON reply (answer/confidence/sources) instead of free-form prose."
            checked={settings.structuredOutput}
            onCheckedChange={(checked) => onUpdate({ structuredOutput: checked })}
          />
        </div>

        {active && (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono">
              {active.versionCount} version{active.versionCount === 1 ? '' : 's'}
            </Badge>
          </div>
        )}
      </div>

      <PromptEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={settings.templateId}
        version={selectedVersion}
        onSaved={(templateId, version) => {
          onUpdate({ templateId, version });
          refresh();
        }}
      />
    </div>
  );
}
