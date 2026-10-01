import type { ObservabilityUsage, TokenCostRates } from './observability.types.js';

/** Rough USD estimate from token usage × env $/1K rates — not a bill. */
export function estimateCostUsd(
  usage: ObservabilityUsage | undefined,
  rates: TokenCostRates,
): number | undefined {
  if (!usage) return undefined;
  const input = (usage.input_tokens / 1000) * rates.inputPer1k;
  const output = (usage.output_tokens / 1000) * rates.outputPer1k;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

/** Truncates a string to `maxChars`, appending an ellipsis marker when cut. */
export function truncateForObservability(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

export function deriveObservabilityMode(flags: {
  useMultiAgent?: boolean;
  useGraph?: boolean;
  useAgent?: boolean;
  useTools?: boolean;
  structuredOutput?: boolean;
}): import('./observability.types.js').ObservabilityMode {
  if (flags.useMultiAgent) return 'multi_agent';
  if (flags.useGraph) return 'graph';
  if (flags.useAgent) return 'agent';
  if (flags.useTools) return 'tools';
  if (flags.structuredOutput) return 'structured';
  return 'normal';
}
