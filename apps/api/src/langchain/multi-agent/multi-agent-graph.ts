import { randomUUID } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { END, START, StateGraph } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { z } from 'zod';

import type { ToolExecutor } from '@/langchain/tools/index.js';
import type {
  CoordinatorDecision,
  DraftVersion,
  ReviewVerdict,
  ToolCallInfo,
} from './multi-agent.types.js';
import {
  buildCoordinatorHumanPrompt,
  buildCoordinatorSystemPrompt,
  buildPlannerHumanPrompt,
  buildPlannerSystemPrompt,
  buildResearcherHumanPrompt,
  buildResearcherSystemPrompt,
  buildReviewerHumanPrompt,
  buildReviewerSystemPrompt,
  buildWriterHumanPrompt,
  buildWriterSystemPrompt,
} from './multi-agent-prompts.js';
import { MultiAgentState, type MultiAgentStateType } from './multi-agent-state.js';

const MAX_PLAN_STEPS = 6;

const MULTI_AGENT_LOOP_EXHAUSTED_TEXT =
  "The team wasn't able to finish and get an approved answer within the allowed number of rounds. Here's the most recent draft, though it may not have been fully reviewed.";

const RESEARCH_LOOP_EXHAUSTED_TEXT =
  'The researcher ran out of tool-call attempts before summarizing its findings — treat this note as incomplete.';

export interface MultiAgentGraphOptions {
  chatModel: BaseChatModel;
  toolExecutor: ToolExecutor;
  checkpointer: BaseCheckpointSaver;
  /** Coordinator round cap (§2 of docs/phases/phase-8-multi-agent.md) — a runaway-loop guard, not a reasoning-depth knob. */
  maxRounds: number;
  /** Per-visit decide->execute iteration cap for the researcher node — same convention as Phase 5's `TOOLS_MAX_ITERATIONS`. */
  researcherMaxToolCalls: number;
}

const coordinatorDecisionSchema = z.object({
  next: z
    .enum(['planner', 'researcher', 'writer', 'reviewer', 'finish'])
    .describe('Which specialist should act next, or "finish" if the draft is approved and ready.'),
  instructions: z
    .string()
    .min(1)
    .describe('Specific instructions for the chosen specialist for this round.'),
});

function plannerOutputSchema(maxSteps: number) {
  return z.object({
    steps: z
      .array(z.string().min(1))
      .min(1)
      .max(maxSteps)
      .describe('An ordered list of high-level steps for the team to follow.'),
  });
}

const reviewerOutputSchema = z.object({
  approved: z.boolean().describe('Whether the draft fully and accurately answers the question.'),
  // The model reliably emits an explicit `null` (not an omitted key) for
  // "no feedback" despite `.optional()` — `.nullable()` accepts that shape,
  // and the transform normalizes it back to `undefined` for the rest of
  // the codebase, which never expects `null`.
  feedback: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? undefined)
    .describe('Specific, actionable feedback for the writer — required when not approved.'),
});

/**
 * Builds and compiles the Phase 8 supervisor graph (§1 of
 * docs/phases/phase-8-multi-agent.md):
 *
 * ```
 * START -> coordinator
 * coordinator -[next: planner]-> planner -> coordinator
 * coordinator -[next: researcher]-> researcher -> coordinator
 * coordinator -[next: writer]-> writer -> coordinator
 * coordinator -[next: reviewer]-> reviewer -> coordinator
 * coordinator -[next: finish]-> END
 * ```
 *
 * Every specialist always reports back to `coordinator` — there's no
 * direct specialist-to-specialist edge (the hub-and-spoke shape that makes
 * `communicationLog` a coherent "conversation" to render).
 */
export function buildMultiAgentGraph(options: MultiAgentGraphOptions) {
  const { chatModel, toolExecutor, checkpointer, maxRounds, researcherMaxToolCalls } = options;

  if (typeof chatModel.bindTools !== 'function') {
    throw new Error('The configured chat model does not support tool calling.');
  }
  const { bindTools } = chatModel;

  function latestInstructions(state: MultiAgentStateType): string {
    return (
      state.communicationLog.at(-1)?.content ??
      'No specific instructions were given yet — use your best judgment.'
    );
  }

  /**
   * The coordinator's routing decision — a deterministic fast path first
   * (approved draft, or round cap reached) so a decision that's already
   * forced never costs an extra LLM call, otherwise one
   * `withStructuredOutput` call informed by a full shared-state summary.
   */
  async function coordinatorNode(
    state: MultiAgentStateType,
  ): Promise<Partial<MultiAgentStateType>> {
    const round = state.roundCount;
    const lastReview = state.reviewHistory.at(-1);

    if (lastReview?.approved) {
      return {
        nextAgent: 'finish',
        roundCount: round + 1,
        communicationLog: [
          {
            round,
            from: 'coordinator',
            to: 'finish',
            content: 'The latest draft was approved by the reviewer.',
          },
        ],
      };
    }

    if (round >= maxRounds) {
      return {
        nextAgent: 'finish',
        roundCount: round + 1,
        communicationLog: [
          {
            round,
            from: 'coordinator',
            to: 'finish',
            content: `Reached the ${maxRounds}-round cap without an approved draft.`,
          },
        ],
      };
    }

    const structuredModel = chatModel.withStructuredOutput<CoordinatorDecision>(
      coordinatorDecisionSchema,
      { name: 'coordinator_decision' },
    );

    const decision = await structuredModel.invoke([
      new SystemMessage(buildCoordinatorSystemPrompt()),
      new HumanMessage(
        buildCoordinatorHumanPrompt({
          question: state.question,
          plan: state.plan,
          researchNotes: state.researchNotes,
          draftHistory: state.draftHistory,
          reviewHistory: state.reviewHistory,
          round,
          maxRounds,
        }),
      ),
    ]);

    return {
      nextAgent: decision.next,
      roundCount: round + 1,
      communicationLog: [
        { round, from: 'coordinator', to: decision.next, content: decision.instructions },
      ],
    };
  }

  function routeAfterCoordinator(
    state: MultiAgentStateType,
  ): 'planner' | 'researcher' | 'writer' | 'reviewer' | typeof END {
    switch (state.nextAgent) {
      case 'planner':
      case 'researcher':
      case 'writer':
      case 'reviewer':
        return state.nextAgent;
      default:
        return END;
    }
  }

  async function plannerNode(state: MultiAgentStateType): Promise<Partial<MultiAgentStateType>> {
    const instructions = latestInstructions(state);
    const structuredModel = chatModel.withStructuredOutput<{ steps: string[] }>(
      plannerOutputSchema(MAX_PLAN_STEPS),
      { name: 'plan' },
    );

    const result = await structuredModel.invoke([
      new SystemMessage(buildPlannerSystemPrompt()),
      new HumanMessage(
        buildPlannerHumanPrompt({ question: state.question, plan: state.plan, instructions }),
      ),
    ]);

    return {
      plan: result.steps,
      communicationLog: [
        {
          round: state.roundCount,
          from: 'planner',
          to: 'coordinator',
          content: `Proposed a ${result.steps.length}-step plan.`,
        },
      ],
    };
  }

  /**
   * Bounded decide -> execute -> feed-results-back loop (§1) — same shape
   * as Phase 5's `generateWithTools`/Phase 7's `agentNode`, just scoped to
   * one visit instead of the whole turn. The final text response (once the
   * model stops requesting tools, or the cap is hit) becomes the shared
   * research note.
   */
  async function researcherNode(state: MultiAgentStateType): Promise<Partial<MultiAgentStateType>> {
    const instructions = latestInstructions(state);
    const bindableTools = toolExecutor.getBindableTools(state.enabledToolNames);
    const modelWithTools = bindTools.call(chatModel, bindableTools);

    const messages: BaseMessage[] = [
      new SystemMessage(
        buildResearcherSystemPrompt({
          context: state.contextText,
          summary: state.summaryText,
          memory: state.memoryText,
        }),
      ),
      new HumanMessage(
        buildResearcherHumanPrompt({
          question: state.question,
          plan: state.plan,
          researchNotes: state.researchNotes,
          instructions,
        }),
      ),
    ];

    const toolCalls: ToolCallInfo[] = [];
    let lastText = '';

    for (let iteration = 0; iteration < researcherMaxToolCalls; iteration++) {
      const response = await modelWithTools.invoke(messages);
      lastText = response.text;
      messages.push(response);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        break;
      }

      for (const call of response.tool_calls) {
        const id = call.id ?? randomUUID();
        const result = await toolExecutor.execute({ id, name: call.name, args: call.args });
        toolCalls.push(result);

        messages.push(
          new ToolMessage({
            content:
              result.status === 'success'
                ? JSON.stringify(result.output)
                : `Error: ${result.error}`,
            tool_call_id: result.id,
            name: result.name,
          }),
        );
      }
    }

    const content = lastText.trim().length > 0 ? lastText.trim() : RESEARCH_LOOP_EXHAUSTED_TEXT;

    return {
      researchNotes: [{ round: state.roundCount, content, toolCalls }],
      toolCallLog: toolCalls,
      communicationLog: [
        {
          round: state.roundCount,
          from: 'researcher',
          to: 'coordinator',
          content:
            toolCalls.length > 0
              ? `${content} (used ${toolCalls.length} tool call${toolCalls.length === 1 ? '' : 's'})`
              : content,
        },
      ],
    };
  }

  async function writerNode(state: MultiAgentStateType): Promise<Partial<MultiAgentStateType>> {
    const instructions = latestInstructions(state);
    const response = await chatModel.invoke([
      new SystemMessage(buildWriterSystemPrompt()),
      new HumanMessage(
        buildWriterHumanPrompt({
          question: state.question,
          plan: state.plan,
          researchNotes: state.researchNotes,
          draftHistory: state.draftHistory,
          reviewHistory: state.reviewHistory,
          instructions,
        }),
      ),
    ]);

    const content =
      response.text.trim().length > 0
        ? response.text.trim()
        : 'The writer was unable to produce a draft this round.';
    const draft: DraftVersion = { round: state.roundCount, content };

    return {
      draftHistory: [draft],
      communicationLog: [
        {
          round: state.roundCount,
          from: 'writer',
          to: 'coordinator',
          content: `Produced a draft (${content.length} characters).`,
        },
      ],
    };
  }

  async function reviewerNode(state: MultiAgentStateType): Promise<Partial<MultiAgentStateType>> {
    const instructions = latestInstructions(state);
    const structuredModel = chatModel.withStructuredOutput<{
      approved: boolean;
      feedback?: string;
    }>(reviewerOutputSchema, { name: 'review_verdict' });

    const verdict = await structuredModel.invoke([
      new SystemMessage(buildReviewerSystemPrompt()),
      new HumanMessage(
        buildReviewerHumanPrompt({
          question: state.question,
          plan: state.plan,
          researchNotes: state.researchNotes,
          draftHistory: state.draftHistory,
          instructions,
        }),
      ),
    ]);

    const review: ReviewVerdict = {
      round: state.roundCount,
      approved: verdict.approved,
      ...(verdict.feedback ? { feedback: verdict.feedback } : {}),
    };

    return {
      reviewHistory: [review],
      communicationLog: [
        {
          round: state.roundCount,
          from: 'reviewer',
          to: 'coordinator',
          content: verdict.approved
            ? 'Approved the draft.'
            : `Rejected the draft: ${verdict.feedback ?? '(no feedback given)'}`,
        },
      ],
    };
  }

  const graph = new StateGraph(MultiAgentState)
    .addNode('coordinator', coordinatorNode)
    .addNode('planner', plannerNode)
    .addNode('researcher', researcherNode)
    .addNode('writer', writerNode)
    .addNode('reviewer', reviewerNode)
    .addEdge(START, 'coordinator')
    .addConditionalEdges('coordinator', routeAfterCoordinator, {
      planner: 'planner',
      researcher: 'researcher',
      writer: 'writer',
      reviewer: 'reviewer',
      [END]: END,
    })
    .addEdge('planner', 'coordinator')
    .addEdge('researcher', 'coordinator')
    .addEdge('writer', 'coordinator')
    .addEdge('reviewer', 'coordinator');

  return graph.compile({ checkpointer });
}

export type CompiledMultiAgentGraph = ReturnType<typeof buildMultiAgentGraph>;

export { MULTI_AGENT_LOOP_EXHAUSTED_TEXT };
