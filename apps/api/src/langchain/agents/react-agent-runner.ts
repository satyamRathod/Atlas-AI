import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage, type UsageMetadata } from '@langchain/core/messages';

import type { ToolExecutor } from '@/langchain/tools/index.js';

import type { AgentLoopEvent, AgentRunInfo, AgentStepInfo } from './agent.types.js';
import { generatePlan } from './planner.js';
import { parseReactResponse } from './react-parser.js';
import { buildReactSystemPrompt, describeTools } from './react-prompt.js';

const AGENT_LOOP_EXHAUSTED_TEXT =
  "I wasn't able to reach a final answer within the allowed number of reasoning steps. Here's my last line of reasoning, though the answer may be incomplete.";

export interface ReactAgentContext {
  context: string;
  summary: string;
  memory: string;
}

export interface ReactAgentToolSelection {
  enabledTools?: string[] | undefined;
}

export interface ReactAgentRunResult {
  reply: string;
  usage: UsageMetadata | undefined;
  agentRun: AgentRunInfo;
}

/**
 * Runs the classic text-based ReAct loop (§2/§4 of
 * docs/phases/phase-6-agents.md) — deliberately a *different* mechanism
 * from Phase 5's native `bindTools`: tools are described as plain text in
 * a fixed system prompt, the model replies in a strict
 * `Thought:`/`Action:`/`Action Input:`/`Final Answer:` text format, and a
 * hand-rolled parser (`react-parser.ts`) extracts the next step. Reuses
 * Phase 5's `ToolExecutor` for actual execution — no new tools, no new
 * timeout/error-handling logic.
 */
export class ReactAgentRunner {
  constructor(
    private readonly chatModel: BaseChatModel,
    private readonly toolExecutor: ToolExecutor,
    private readonly options: { maxSteps: number; planMaxSteps: number },
  ) {}

  public async *run(
    question: string,
    context: ReactAgentContext,
    toolSelection: ReactAgentToolSelection,
  ): AsyncGenerator<AgentLoopEvent, ReactAgentRunResult, void> {
    const registeredTools = this.toolExecutor.getRegisteredTools(toolSelection.enabledTools);
    const toolDescriptors = describeTools(registeredTools);

    const plan = await generatePlan(
      this.chatModel,
      question,
      toolDescriptors,
      this.options.planMaxSteps,
    );
    yield { type: 'agent_plan', plan: plan.steps };

    const systemPrompt = buildReactSystemPrompt({
      tools: toolDescriptors,
      plan: plan.steps,
      context: context.context,
      summary: context.summary,
      memory: context.memory,
    });

    const steps: AgentStepInfo[] = [];
    let scratchpad = '';
    let usage: UsageMetadata | undefined;
    let lastThought = '';

    for (let index = 0; index < this.options.maxSteps; index++) {
      const start = performance.now();
      const human = scratchpad.length > 0 ? `${question}\n\n${scratchpad}` : question;

      const response = await this.chatModel.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(human),
      ]);
      usage = response.usage_metadata ?? usage;

      const parsed = parseReactResponse(response.text);
      lastThought = parsed.thought;

      if (!parsed.action) {
        const finalStep: AgentStepInfo = {
          index,
          thought: parsed.thought || parsed.finalAnswer || '',
          status: 'final',
          durationMs: Math.round(performance.now() - start),
        };
        steps.push(finalStep);

        yield { type: 'agent_thought', step: { index, thought: finalStep.thought } };

        return {
          reply: parsed.finalAnswer || parsed.thought || AGENT_LOOP_EXHAUSTED_TEXT,
          usage,
          agentRun: { plan: plan.steps, steps },
        };
      }

      const actionInput = parsed.actionInput ?? {};

      yield {
        type: 'agent_thought',
        step: { index, thought: parsed.thought, action: parsed.action, actionInput },
      };

      const result = await this.toolExecutor.execute({
        name: parsed.action,
        args: actionInput,
      });

      const step: AgentStepInfo = {
        index,
        thought: parsed.thought,
        action: parsed.action,
        actionInput,
        status: result.status,
        ...(result.output !== undefined ? { observation: result.output } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
        durationMs: Math.round(performance.now() - start),
      };
      steps.push(step);

      yield { type: 'agent_observation', step };

      scratchpad += `${scratchpad.length > 0 ? '\n\n' : ''}Thought: ${parsed.thought}\nAction: ${parsed.action}\nAction Input: ${JSON.stringify(actionInput)}\nObservation: ${
        result.status === 'success' ? JSON.stringify(result.output) : `Error: ${result.error}`
      }`;
    }

    return {
      reply: lastThought.trim().length > 0 ? lastThought : AGENT_LOOP_EXHAUSTED_TEXT,
      usage,
      agentRun: { plan: plan.steps, steps },
    };
  }
}
