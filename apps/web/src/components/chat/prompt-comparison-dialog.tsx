import { AlertTriangle, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { sendChatMessage } from '@/lib/api';
import { listPromptTemplates } from '@/lib/prompts-api';
import { DEFAULT_RETRIEVAL_SETTINGS } from '@/lib/retrieval-options';
import type { ChatResponse, PromptTemplateSummary } from '@/types/chat';

interface PromptComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Slot {
  templateId: string;
  useFewShot: boolean;
}

interface SlotResult {
  loading: boolean;
  response?: ChatResponse;
  error?: string;
}

function SlotPicker({
  label,
  templates,
  slot,
  onChange,
}: {
  label: string;
  templates: readonly PromptTemplateSummary[];
  slot: Slot;
  onChange: (patch: Partial<Slot>) => void;
}) {
  return (
    <div className="bg-muted/30 flex flex-col gap-2 rounded-md border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">Prompt {label}</span>
        <Select value={slot.templateId} onValueChange={(value) => onChange({ templateId: value })}>
          <SelectTrigger size="sm" className="w-[140px]">
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">Few-shot</span>
        <Switch
          checked={slot.useFewShot}
          onCheckedChange={(checked) => onChange({ useFewShot: checked })}
        />
      </div>
    </div>
  );
}

function ResultCard({ label, slot, result }: { label: string; slot: Slot; result?: SlotResult }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="font-mono">
          {label}
        </Badge>
        {result?.response && (
          <>
            <Badge variant="secondary">
              {result.response.promptInfo.templateName} v{result.response.promptInfo.version}
            </Badge>
            {slot.useFewShot && result.response.promptInfo.usedFewShot && (
              <Badge variant="outline">Few-shot</Badge>
            )}
            {result.response.guardrails.blocked && <Badge variant="destructive">Blocked</Badge>}
          </>
        )}
      </div>

      {result?.loading && <p className="text-muted-foreground text-xs">Running…</p>}

      {result?.error && (
        <p className="text-destructive flex items-center gap-1.5 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" />
          {result.error}
        </p>
      )}

      {result?.response && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.response.reply}</p>
      )}

      {!result && <p className="text-muted-foreground text-xs">Not run yet.</p>}
    </div>
  );
}

/**
 * Prompt comparison dialog (Phase 4 UI) — a dedicated side-by-side view:
 * pick two template/few-shot combinations, ask one question once, fire two
 * parallel non-streaming `POST /api/v1/chat` requests with no `sessionId`
 * (isolated — doesn't touch the real conversation or its memory), and
 * render the replies next to each other. Kept out of the normal streaming
 * chat flow entirely, per docs/phases/phase-4-prompt-engineering.md's
 * documented trade-offs.
 */
export function PromptComparisonDialog({ open, onOpenChange }: PromptComparisonDialogProps) {
  const [templates, setTemplates] = useState<PromptTemplateSummary[]>([]);
  const [question, setQuestion] = useState('');
  const [slotA, setSlotA] = useState<Slot>({ templateId: 'default', useFewShot: false });
  const [slotB, setSlotB] = useState<Slot>({ templateId: 'concise', useFewShot: true });
  const [running, setRunning] = useState(false);
  const [resultA, setResultA] = useState<SlotResult | undefined>();
  const [resultB, setResultB] = useState<SlotResult | undefined>();

  useEffect(() => {
    if (!open) return;
    listPromptTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open]);

  const runComparison = async () => {
    const trimmed = question.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setResultA({ loading: true });
    setResultB({ loading: true });

    const [a, b] = await Promise.allSettled([
      sendChatMessage(trimmed, undefined, DEFAULT_RETRIEVAL_SETTINGS, {
        templateId: slotA.templateId,
        useFewShot: slotA.useFewShot,
        structuredOutput: false,
      }),
      sendChatMessage(trimmed, undefined, DEFAULT_RETRIEVAL_SETTINGS, {
        templateId: slotB.templateId,
        useFewShot: slotB.useFewShot,
        structuredOutput: false,
      }),
    ]);

    setResultA(
      a.status === 'fulfilled'
        ? { loading: false, response: a.value }
        : {
            loading: false,
            error: a.reason instanceof Error ? a.reason.message : 'Request failed.',
          },
    );
    setResultB(
      b.status === 'fulfilled'
        ? { loading: false, response: b.value }
        : {
            loading: false,
            error: b.reason instanceof Error ? b.reason.message : 'Request failed.',
          },
    );
    setRunning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare prompts</DialogTitle>
          <DialogDescription>
            Ask one question against two prompt setups side by side. Runs in isolation — no session
            or memory continuity.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          rows={2}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SlotPicker
            label="A"
            templates={templates}
            slot={slotA}
            onChange={(patch) => setSlotA((prev) => ({ ...prev, ...patch }))}
          />
          <SlotPicker
            label="B"
            templates={templates}
            slot={slotB}
            onChange={(patch) => setSlotB((prev) => ({ ...prev, ...patch }))}
          />
        </div>

        <Button onClick={runComparison} disabled={running || !question.trim()} className="gap-1.5">
          <Play className="size-3.5" />
          {running ? 'Running…' : 'Run comparison'}
        </Button>

        {(resultA || resultB) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ResultCard label="A" slot={slotA} result={resultA} />
            <ResultCard label="B" slot={slotB} result={resultB} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
