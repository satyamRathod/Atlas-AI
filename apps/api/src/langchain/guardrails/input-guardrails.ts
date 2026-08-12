import { env } from '@/config/env.js';

import type { GuardrailResult } from './guardrail.types.js';

/** Common prompt-injection phrasing — a heuristic, not a defense against a
 * determined attacker (there's no adversarial-robustness guarantee here). */
const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore (all|any|the) (previous|prior|above) instructions/i,
  /disregard (all|any|the) (previous|prior|above) (instructions|rules)/i,
  /reveal (your|the) system prompt/i,
  /you are now (in )?(developer|debug|jailbreak|dan) mode/i,
  /forget (everything|all) (you('ve| have) been told|instructions)/i,
];

function checkBlockedTerms(message: string): GuardrailResult {
  const lower = message.toLowerCase();
  const matched = env.PROMPT_GUARDRAILS_BLOCKED_TERMS.find((term) => lower.includes(term));

  return matched
    ? { name: 'blocked-terms', passed: false, message: `Contains a blocked term: "${matched}".` }
    : { name: 'blocked-terms', passed: true };
}

function checkPromptInjection(message: string): GuardrailResult {
  const matched = INJECTION_PATTERNS.some((pattern) => pattern.test(message));

  return matched
    ? {
        name: 'prompt-injection-heuristic',
        passed: false,
        message:
          'Message resembles a prompt-injection attempt (e.g. "ignore previous instructions").',
      }
    : { name: 'prompt-injection-heuristic', passed: true };
}

/**
 * Input guardrails (§5) — run on the raw user message *before* retrieval or
 * generation. In `PROMPT_GUARDRAILS_MODE=block`, any failing result here
 * short-circuits `ChatService` with a synthesized refusal; in `observe`
 * mode, generation proceeds normally and these are purely informational.
 */
export function runInputGuardrails(message: string): GuardrailResult[] {
  return [checkBlockedTerms(message), checkPromptInjection(message)];
}
