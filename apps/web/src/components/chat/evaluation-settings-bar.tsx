import { ClipboardCheck, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { EvaluationSettings } from '@/types/chat';

interface EvaluationSettingsBarProps {
  settings: EvaluationSettings;
  onUpdate: (patch: Partial<EvaluationSettings>) => void;
  onReset: () => void;
}

/**
 * Evaluation settings bar (Phase 9 UI) — opt-in `useEvaluation` toggle.
 * Orthogonal to generation modes: scores whatever reply the active mode
 * produced.
 */
export function EvaluationSettingsBar({ settings, onUpdate, onReset }: EvaluationSettingsBarProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="bg-card flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Evaluate reply</span>
            <Switch
              checked={settings.useEvaluation}
              onCheckedChange={(checked) => onUpdate({ useEvaluation: checked })}
            />
          </div>

          <p className="text-muted-foreground max-w-sm flex-1 text-xs leading-relaxed">
            After the answer is generated, score faithfulness, context precision, recall (when
            ground truth is provided), and hallucination. Independent of Tools / Agent / Graph /
            Multi-agent mode.
          </p>

          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
