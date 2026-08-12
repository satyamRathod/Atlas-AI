/** One guardrail check's outcome for a single turn. */
export interface GuardrailResult {
  name: string;
  passed: boolean;
  /** Only set when `passed` is `false` — explains what tripped the check. */
  message?: string;
}

/**
 * Per-turn guardrail results attached to the chat API response (§5) —
 * `blocked: true` means an input check failed in `block` mode and the LLM
 * was never called; the client renders `reply` (a synthesized refusal) the
 * same way as any other turn.
 */
export interface GuardrailReport {
  input: GuardrailResult[];
  output: GuardrailResult[];
  blocked: boolean;
}
