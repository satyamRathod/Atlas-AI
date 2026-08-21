/**
 * The `agent` node's system prompt (§3 of docs/phases/phase-7-langgraph.md).
 * Unlike Phase 6's ReAct prompt, tools are never described in plain text
 * here — the model gets them via native `bindTools()`, so the prompt is
 * just the assistant's role plus the same context/summary/memory blocks
 * every other generation mode already uses.
 */
export function buildGraphSystemPrompt(input: {
  context: string;
  summary: string;
  memory: string;
}): string {
  return `You are a helpful assistant with access to tools. Use the provided context, conversation summary, and remembered facts to answer the user's question. Call a tool only when it's genuinely needed to answer accurately; otherwise answer directly.

Some tools require human approval before they run — if a tool call you make is rejected, acknowledge that in your final answer instead of retrying it.

Context:
${input.context}

Conversation summary:
${input.summary}

Remembered facts:
${input.memory}`;
}
