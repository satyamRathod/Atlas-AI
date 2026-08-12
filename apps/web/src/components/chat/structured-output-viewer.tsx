import { Braces, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { StructuredOutputInfo } from '@/types/chat';

interface StructuredOutputViewerProps {
  structuredOutput?: StructuredOutputInfo;
}

const CONFIDENCE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};

/**
 * Structured output viewer (Phase 4 UI) — renders the validated JSON reply
 * from `structuredOutput` (docs/phases/phase-4-prompt-engineering.md §4)
 * pretty-printed, with a valid/invalid badge. Only rendered when the
 * request actually asked for `structuredOutput: true`.
 */
export function StructuredOutputViewer({ structuredOutput }: StructuredOutputViewerProps) {
  const [open, setOpen] = useState(false);

  if (!structuredOutput) return null;

  const { data, valid, errors, schemaName } = structuredOutput;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Braces className="size-3.5" />
        Structured output
        <Badge variant={valid ? 'secondary' : 'destructive'}>{valid ? 'Valid' : 'Invalid'}</Badge>
        {data?.confidence && (
          <Badge variant={CONFIDENCE_VARIANT[data.confidence] ?? 'outline'} className="capitalize">
            {data.confidence} confidence
          </Badge>
        )}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        <span className="text-muted-foreground font-mono text-[11px]">schema: {schemaName}</span>
        {data ? (
          <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-2.5 text-xs whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
        {errors && errors.length > 0 && (
          <ul className="text-destructive flex flex-col gap-1 text-xs">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
