import { Info, RotateCcw } from 'lucide-react';

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
import {
  CATEGORY_OPTIONS,
  DOC_TYPE_OPTIONS,
  getStrategyOption,
  RETRIEVAL_STRATEGY_OPTIONS,
} from '@/lib/retrieval-options';
import { cn } from '@/lib/utils';
import type { RetrievalSettings, RetrievalStrategy } from '@/types/chat';

interface RetrievalSettingsBarProps {
  settings: RetrievalSettings;
  onUpdate: (patch: Partial<RetrievalSettings>) => void;
  onReset: () => void;
}

const ALL_VALUE = '__all__';

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  disabledReason,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const inputId = `retrieval-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div
      className={cn(
        'bg-muted/30 flex items-center justify-between gap-3 rounded-md border px-3 py-2',
        disabled && 'opacity-60',
      )}
    >
      <label htmlFor={inputId} className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {label}
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground size-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              {disabled && disabledReason ? disabledReason : description}
            </TooltipContent>
          </Tooltip>
        </span>
      </label>
      <Switch
        id={inputId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function RetrievalSettingsBar({ settings, onUpdate, onReset }: RetrievalSettingsBarProps) {
  const activeStrategy = getStrategyOption(settings.strategy);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="bg-card flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">Retrieval strategy</span>
            <Select
              value={settings.strategy}
              onValueChange={(value) => onUpdate({ strategy: value as RetrievalStrategy })}
            >
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETRIEVAL_STRATEGY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-muted-foreground max-w-xs flex-1 text-xs leading-relaxed">
            {activeStrategy.description}
          </p>

          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ToggleRow
            label="MMR"
            description="Re-select results to balance relevance against diversity."
            checked={settings.useMmr}
            disabled={!activeStrategy.supportsMmr}
            disabledReason="Only available for dense and hybrid strategies."
            onCheckedChange={(checked) => onUpdate({ useMmr: checked })}
          />
          <ToggleRow
            label="Rerank"
            description="Re-score candidates with a local cross-encoder model."
            checked={settings.useRerank}
            onCheckedChange={(checked) => onUpdate({ useRerank: checked })}
          />
          <ToggleRow
            label="Compression"
            description="Drop chunks below a similarity bar before generation."
            checked={settings.useCompression}
            onCheckedChange={(checked) => onUpdate({ useCompression: checked })}
          />
          <ToggleRow
            label="Query expansion"
            description="Have the LLM broaden the query before searching."
            checked={settings.useQueryExpansion}
            disabled={!activeStrategy.supportsQueryExpansion}
            disabledReason="Only available for dense and hybrid strategies."
            onCheckedChange={(checked) => onUpdate({ useQueryExpansion: checked })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-xs font-medium">Metadata filters</span>

          {activeStrategy.supportsFilters ? (
            <>
              <Select
                value={settings.category ?? ALL_VALUE}
                onValueChange={(value) =>
                  onUpdate({ category: value === ALL_VALUE ? undefined : value })
                }
              >
                <SelectTrigger size="sm" className="w-[130px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All categories</SelectItem>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={settings.docType ?? ALL_VALUE}
                onValueChange={(value) =>
                  onUpdate({ docType: value === ALL_VALUE ? undefined : value })
                }
              >
                <SelectTrigger size="sm" className="w-[130px]">
                  <SelectValue placeholder="Doc type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All doc types</SelectItem>
                  {DOC_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(settings.category || settings.docType) && (
                <Badge variant="secondary" className="font-mono">
                  {[settings.category, settings.docType].filter(Boolean).join(' · ')}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-muted-foreground font-normal">
              {settings.strategy === 'self_query'
                ? 'Derived automatically from your question'
                : 'Not supported by this strategy'}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
