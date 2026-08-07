import { Clock, Gauge, Hash } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatUsage } from '@/types/chat';

interface UsageBadgesProps {
  usage?: ChatUsage;
  model?: string;
  latencyMs?: number;
  firstTokenMs?: number;
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function UsageBadges({ usage, model, latencyMs, firstTokenMs }: UsageBadgesProps) {
  if (!usage && latencyMs === undefined && !model) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {model && (
        <Badge variant="outline" className="font-mono">
          {model}
        </Badge>
      )}
      {usage && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <Hash className="size-3" />
              {usage.total_tokens} tokens
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {usage.input_tokens} in / {usage.output_tokens} out
          </TooltipContent>
        </Tooltip>
      )}
      {latencyMs !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <Clock className="size-3" />
              {formatMs(latencyMs)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Total response time</TooltipContent>
        </Tooltip>
      )}
      {firstTokenMs !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <Gauge className="size-3" />
              {formatMs(firstTokenMs)} to first token
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Time from request to the first streamed token</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
