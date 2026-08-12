import { env } from '@/config/env.js';

import type { GuardrailResult } from './guardrail.types.js';

const CITATION_PATTERN = /\[\d+\]/;

function checkBannedPhrases(reply: string): GuardrailResult {
  const lower = reply.toLowerCase();
  const matched = env.PROMPT_GUARDRAILS_BLOCKED_TERMS.find((term) => lower.includes(term));

  return matched
    ? {
        name: 'banned-phrase-check',
        passed: false,
        message: `Reply contains a blocked term: "${matched}".`,
      }
    : { name: 'banned-phrase-check', passed: true };
}

/**
 * Soft, always-observe check: flags (never blocks) a prose reply that had
 * context to work with but cites nothing — there's no regenerate-on-fail
 * loop, so this is purely informational (§5's documented limitation).
 * Doesn't apply to structured output, which cites via the `sources` field
 * instead of bracketed text citations.
 */
function checkCitationGrounding(reply: string, hasContext: boolean): GuardrailResult {
  if (!hasContext || CITATION_PATTERN.test(reply)) {
    return { name: 'citation-grounding', passed: true };
  }

  return {
    name: 'citation-grounding',
    passed: false,
    message: 'Context was retrieved for this turn, but the reply cites no sources.',
  };
}

export interface OutputGuardrailOptions {
  /** Whether any context chunks were retrieved for this turn. */
  hasContext: boolean;
  /** Structured-output replies cite via `sources`, not bracketed text — skip the citation check. */
  isStructuredOutput: boolean;
}

/**
 * Output guardrails (§5) — run on the generated reply. Unlike input
 * guardrails, these never short-circuit the response (the LLM call already
 * happened); they're reported on `guardrails.output` for observability.
 */
export function runOutputGuardrails(
  reply: string,
  { hasContext, isStructuredOutput }: OutputGuardrailOptions,
): GuardrailResult[] {
  const results = [checkBannedPhrases(reply)];

  if (!isStructuredOutput) {
    results.push(checkCitationGrounding(reply, hasContext));
  }

  return results;
}
