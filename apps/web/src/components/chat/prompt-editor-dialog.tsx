import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { addPromptVersion, createPromptTemplate, getPromptTemplate } from '@/lib/prompts-api';
import type { PromptFewShotExample } from '@/types/chat';

interface PromptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template currently selected in the settings bar — pre-fills the editor when editing (as opposed to creating a new template). */
  templateId: string;
  version?: number;
  onSaved: (templateId: string, version: number) => void;
}

/** No `Input` primitive exists in `components/ui` yet — this matches `Textarea`'s styling for single-line fields. Exported for reuse by `prompt-comparison-dialog.tsx`. */
export const TEXT_FIELD_CLASSES =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

function emptyExample(): PromptFewShotExample {
  return { input: '', output: '' };
}

/**
 * Prompt editor dialog (Phase 4 UI) — edit a system prompt + few-shot
 * examples and save it either as a new version of the currently-selected
 * template, or as a brand-new template. Mirrors this codebase's other
 * dialogs (`Dialog` + `Textarea`), with a small inline example-list editor
 * since there's no repeatable-field primitive in `components/ui` yet.
 */
export function PromptEditorDialog({
  open,
  onOpenChange,
  templateId,
  version,
  onSaved,
}: PromptEditorDialogProps) {
  const [mode, setMode] = useState<'edit' | 'new'>('edit');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [examples, setExamples] = useState<PromptFewShotExample[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;

    setMode('edit');
    setNewId('');
    setNewName('');
    setNewDescription('');
    setError(undefined);
    setLoading(true);

    getPromptTemplate(templateId, version)
      .then((detail) => {
        const selected = detail.versions[0];
        setSystemPrompt(selected?.systemPrompt ?? '');
        setExamples(selected?.fewShotExamples.length ? [...selected.fewShotExamples] : []);
      })
      .catch(() => {
        setSystemPrompt('');
        setExamples([]);
      })
      .finally(() => setLoading(false));
  }, [open, templateId, version]);

  const updateExample = (index: number, patch: Partial<PromptFewShotExample>) => {
    setExamples((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)));
  };

  const removeExample = (index: number) => {
    setExamples((prev) => prev.filter((_, i) => i !== index));
  };

  const canSave =
    systemPrompt.trim().length > 0 &&
    (mode === 'edit' || (newId.trim().length > 0 && newName.trim().length > 0));

  const handleSave = async () => {
    setSaving(true);
    setError(undefined);

    const cleanedExamples = examples.filter((ex) => ex.input.trim() && ex.output.trim());

    try {
      if (mode === 'new') {
        const detail = await createPromptTemplate({
          id: newId.trim(),
          name: newName.trim(),
          description: newDescription.trim(),
          systemPrompt,
          fewShotExamples: cleanedExamples,
        });
        onSaved(detail.id, detail.latestVersion);
      } else {
        const saved = await addPromptVersion(templateId, {
          systemPrompt,
          fewShotExamples: cleanedExamples,
        });
        onSaved(templateId, saved.version);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prompt editor</DialogTitle>
          <DialogDescription>
            Edit the system prompt and few-shot examples, then save as a new version — versions are
            never overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          <Button
            type="button"
            variant={mode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('edit')}
          >
            Save new version of "{templateId}"
          </Button>
          <Button
            type="button"
            variant={mode === 'new' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('new')}
          >
            Create new template
          </Button>
        </div>

        {mode === 'new' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">
                Id (lowercase, hyphens)
              </span>
              <input
                className={TEXT_FIELD_CLASSES}
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="formal"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">Name</span>
              <input
                className={TEXT_FIELD_CLASSES}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Formal"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">Description</span>
              <input
                className={TEXT_FIELD_CLASSES}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="A more formal tone, still cites sources."
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            System prompt (use {'{context}'}, {'{summary}'}, {'{memory}'} where relevant)
          </span>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={loading}
            rows={10}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Few-shot examples ({examples.length})
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExamples((prev) => [...prev, emptyExample()])}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Add example
            </Button>
          </div>

          {examples.map((example, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: examples are reordered/removed by index, no stable id
              key={index}
              className="bg-muted/30 grid grid-cols-[1fr_1fr_auto] gap-2 rounded-md border p-2"
            >
              <Textarea
                value={example.input}
                onChange={(e) => updateExample(index, { input: e.target.value })}
                placeholder="Example question"
                rows={2}
                className="text-xs"
              />
              <Textarea
                value={example.output}
                onChange={(e) => updateExample(index, { output: e.target.value })}
                placeholder="Example answer"
                rows={2}
                className="text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeExample(index)}
                aria-label="Remove example"
                className="self-start"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {error && <p className="text-destructive text-xs">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving || loading}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
