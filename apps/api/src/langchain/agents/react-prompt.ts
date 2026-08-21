import { z } from 'zod';

import type { RegisteredTool } from '@/langchain/tools/index.js';

import type { AgentToolDescriptor } from './agent.types.js';

/** A short `{ field: type }` summary of a tool's args schema — rendered as plain text into the system prompt (§2 of docs/phases/phase-6-agents.md), deliberately not the native JSON-Schema `bindTools` payload. */
function describeArgsShape(schema: RegisteredTool['schema']): string {
  const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any' }) as {
    properties?: Record<string, { type?: string }>;
    required?: string[];
  };
  const properties = jsonSchema.properties ?? {};
  const required = new Set(jsonSchema.required ?? []);
  const fields = Object.entries(properties).map(
    ([key, value]) => `${key}${required.has(key) ? '' : '?'}: ${value.type ?? 'any'}`,
  );

  return fields.length > 0 ? `{ ${fields.join(', ')} }` : '{}';
}

/** Builds the plain-text tool descriptors `react-agent-runner.ts` embeds in the system prompt, from Phase 5's `RegisteredTool`s — the ReAct analogue of what `bindTools` does natively. */
export function describeTools(tools: readonly RegisteredTool[]): AgentToolDescriptor[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    argsHint: describeArgsShape(tool.schema),
  }));
}

const FORMAT_INSTRUCTIONS = `You are Atlas, an AI assistant that reasons step by step and can use tools to help answer questions.

Use the following strict format for every response — do not deviate from it:

Thought: <your reasoning about what to do next>
Action: <the exact name of one tool to call>
Action Input: <a single-line JSON object with that tool's arguments>

After a tool runs you will be given its result as an "Observation:" line, appended to this conversation. Continue with more Thought/Action/Action Input turns as needed.

Once you know the final answer, respond with ONLY:

Thought: <your final reasoning>
Final Answer: <the complete answer to the user's question>

Rules:
- Only ever take ONE action per response — never multiple Action blocks in one reply.
- Only call a tool when it actually helps answer the question; if you already know the answer, go straight to "Final Answer:".
- "Action Input:" must be valid JSON on a single line (use {} if the tool takes no arguments).
- Never invent a tool name that isn't listed below.

Example:

Thought: The user asked for the sum of 12 and 30, so I should use the calculator.
Action: calculator
Action Input: {"expression": "12 + 30"}

(...after receiving "Observation: 42"...)

Thought: I now know the final answer.
Final Answer: 12 + 30 is 42.`;

export interface ReactSystemPromptInput {
  tools: readonly AgentToolDescriptor[];
  plan: readonly string[];
  context: string;
  summary: string;
  memory: string;
}

/**
 * The fixed ReAct system prompt (§2 of docs/phases/phase-6-agents.md) — not
 * sourced from Phase 4's prompt-template registry, since mixing an
 * arbitrary user-edited template with this strict Thought/Action/Action
 * Input/Final Answer parsing contract is out of scope. Embeds the same
 * always-on RAG `context`/`summary`/`memory` blocks `ChatService` already
 * resolves for every other branch, plus the upfront plan (§2, `planner.ts`)
 * as a suggested — not mandatory — sequence of steps.
 */
export function buildReactSystemPrompt({
  tools,
  plan,
  context,
  summary,
  memory,
}: ReactSystemPromptInput): string {
  const toolsBlock =
    tools.length > 0
      ? tools.map((tool) => `- ${tool.name}${tool.argsHint}: ${tool.description}`).join('\n')
      : '(no tools are currently enabled)';

  const planBlock =
    plan.length > 0
      ? plan.map((step, index) => `${index + 1}. ${step}`).join('\n')
      : '(no plan was generated)';

  return `${FORMAT_INSTRUCTIONS}

Available tools:
${toolsBlock}

Suggested plan for this question (you may deviate if it turns out to be wrong):
${planBlock}

Knowledge base context retrieved for this question:
${context}

Conversation summary so far:
${summary}

Remembered facts about this user/conversation:
${memory}`;
}
