import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { logger } from '@/infrastructure/logger/index.js';

import type { AgentToolDescriptor } from './agent.types.js';

const PLAN_SYSTEM_PROMPT = `You are a planning assistant. Given a user's question and a list of tools available to another AI agent, propose a short ordered list of high-level steps the agent should take to answer the question well. Keep each step to one short sentence. If no tools are needed, a single-step plan ("Answer directly from the available context.") is fine.`;

function buildPlanSchema(maxSteps: number) {
  return z.object({
    steps: z
      .array(z.string().min(1))
      .min(1)
      .max(maxSteps)
      .describe('An ordered list of high-level steps to answer the question.'),
  });
}

/**
 * The upfront planning step (§2 of docs/phases/phase-6-agents.md) — one
 * `withStructuredOutput` call (reusing Phase 4's structured-output
 * mechanism, see `chat.service.ts`'s `generateStructured`) that proposes a
 * short ordered list of intended steps *before* the ReAct loop starts.
 * `ReactAgentRunner` renders this into the system prompt as a suggestion,
 * not a hard constraint — the model may deviate step by step.
 *
 * Fails open: if the structured call errors for any reason, falls back to
 * a single generic step rather than failing the whole turn.
 */
export async function generatePlan(
  chatModel: BaseChatModel,
  question: string,
  tools: readonly AgentToolDescriptor[],
  maxSteps: number,
): Promise<{ steps: string[] }> {
  const toolsList =
    tools.length > 0
      ? tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')
      : '(no tools are currently enabled)';

  try {
    const structuredModel = chatModel.withStructuredOutput<{ steps: string[] }>(
      buildPlanSchema(maxSteps),
      { name: 'agent_plan' },
    );

    const result = await structuredModel.invoke([
      new SystemMessage(PLAN_SYSTEM_PROMPT),
      new HumanMessage(`Question: ${question}\n\nAvailable tools:\n${toolsList}`),
    ]);

    return { steps: result.steps };
  } catch (error) {
    logger.error({ error }, 'Agent plan generation failed; falling back to a single-step plan');
    return { steps: ['Answer the question using the available context and tools as needed.'] };
  }
}
