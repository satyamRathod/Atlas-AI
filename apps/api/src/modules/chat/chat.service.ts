import { randomUUID } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  type AIMessageChunk,
  type BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { concat } from '@langchain/core/utils/stream';
import { env } from '@/config/env.js';
import { logger } from '@/infrastructure/logger/index.js';
import type { AgentLoopEvent, AgentRunInfo, ReactAgentRunner } from '@/langchain/agents/index.js';
import type {
  GraphAgentRunner,
  GraphLoopEvent,
  GraphNodeInfo,
  GraphResumeDecision,
  GraphRunInfo,
  PendingApprovalInfo,
} from '@/langchain/graph/index.js';
import {
  type GuardrailResult,
  runInputGuardrails,
  runOutputGuardrails,
} from '@/langchain/guardrails/index.js';
import {
  computeHistoryBudget,
  countMessageTokens,
  countTokens,
  extractMemoryFacts,
  type MemoryInfo,
  type SemanticFact,
  type SemanticMemoryStore,
  summarizeHistory,
  type TokenBudgetPlan,
  trimHistory,
} from '@/langchain/memory/index.js';
import type {
  MultiAgentLoopEvent,
  MultiAgentRunInfo,
  MultiAgentRunner,
} from '@/langchain/multi-agent/index.js';
import { STRUCTURED_ANSWER_SCHEMA, type StructuredAnswer } from '@/langchain/parsers/index.js';
import { buildDynamicPrompt } from '@/langchain/prompts/index.js';
import type { RetrievalPipeline, RetrievalStrategy } from '@/langchain/retrieval/index.js';
import type { RetrievedChunk } from '@/langchain/retrievers/index.js';
import type { ToolCallInfo, ToolCallStart, ToolExecutor } from '@/langchain/tools/index.js';
import type { PromptResolvedTemplate, PromptService } from '@/modules/prompts/prompt.service.js';

import type { ChatRequestInput } from './chat.schema.js';
import type {
  ChatCitation,
  ChatResponse,
  PromptInfo,
  RetrievalInfo,
  RetrievalOptions,
  StreamChunk,
  StreamOptions,
  StructuredOutputInfo,
} from './chat.types.js';
import type { RedisChatMemoryStore } from './infrastructure/redis-chat-memory-store.js';

interface RagChainInput {
  context: string;
  summary: string;
  memory: string;
  history: BaseMessage[];
  question: string;
}

/** Result of loading + (maybe) summarizing/compacting a session's memory
 * for the current turn — see `prepareMemoryContext()`. */
interface MemoryContext {
  /** The raw history that will actually be sent this turn, *before*
   * token-budget trimming (§4) — either the full stored history, or just
   * the kept tail if summarization (§5) just ran. */
  rawMessages: BaseMessage[];
  summary: string;
  summarized: boolean;
  semanticFacts: SemanticFact[];
}

/** Which prompt template/version to use, and how to use it — resolved once
 * per turn from the request's optional Phase 4 fields (chat.schema.ts). */
interface PromptSelection {
  templateId?: string | undefined;
  version?: number | undefined;
  useFewShot: boolean;
  structuredOutput: boolean;
}

/** Whether this turn should run the tool-calling loop, and which registered tools it may use (§4 of docs/phases/phase-5-tools.md). */
interface ToolSelection {
  useTools: boolean;
  enabledTools?: string[] | undefined;
}

/** Whether this turn should run the ReAct agent loop instead, and which registered tools it may use (§3 of docs/phases/phase-6-agents.md). Takes precedence over `ToolSelection`/structured output when `true`. */
interface AgentSelection {
  useAgent: boolean;
  enabledTools?: string[] | undefined;
}

/** Whether this turn should run the LangGraph agent<->tools graph instead, and which registered tools it may use (§2 of docs/phases/phase-7-langgraph.md). Takes precedence over every mode below when `true`. */
interface GraphSelection {
  useGraph: boolean;
  enabledTools?: string[] | undefined;
}

/** Whether this turn should run the Phase 8 supervisor graph instead, and which registered tools the researcher specialist may use (§1/§4 of docs/phases/phase-8-multi-agent.md). Highest precedence of all modes when `true`. */
interface MultiAgentSelection {
  useMultiAgent: boolean;
  enabledTools?: string[] | undefined;
}

/**
 * Everything a *resume* request needs to reconstruct the turn's response
 * that a fresh request already has in local variables — citations,
 * retrieval/memory/prompt info, and the original question. Stashed as an
 * opaque field on the graph's own checkpointed state at the start of
 * `generateWithGraph()`, and read back by `invokeResume()`/`streamResume()`
 * after the interrupt/resume round-trip, since a resume call is a brand
 * new HTTP request with none of that context available otherwise.
 */
interface GraphTurnMeta {
  question: string;
  citations: ChatCitation[];
  retrieval: RetrievalInfo;
  memory: MemoryInfo;
  promptInfo: PromptInfo;
  hasContext: boolean;
}

/** One `tool_call`/`tool_result` pair as it happens, mid-loop — what `generateWithTools()` yields so the streaming path can forward it live. */
type ToolLoopEvent =
  | { type: 'tool_call'; toolCall: ToolCallStart }
  | { type: 'tool_result'; toolResult: ToolCallInfo };

interface ToolLoopResult {
  reply: string;
  usage: ChatResponse['usage'];
  toolCalls: ToolCallInfo[];
}

interface AgentLoopResult {
  reply: string;
  usage: ChatResponse['usage'];
  agentRun: AgentRunInfo;
}

/** What `generateWithGraph()`/`resumeGraph()` resolve to once a run finishes *or* pauses — `graphRun.interrupted` tells the caller which. */
interface GraphLoopResult {
  reply: string;
  usage?: ChatResponse['usage'];
  graphRun: GraphRunInfo;
  /** Only present when resuming — read back from the checkpointed state, since a resume request has no `turnMeta` of its own to build. */
  resumedTurnMeta?: GraphTurnMeta;
}

/**
 * What `generateWithMultiAgent()` resolves to once the coordinator decides
 * to finish. Unlike `GraphLoopResult`, there's no `interrupted` flag or
 * resume path — a multi-agent turn always runs to completion in one call
 * (§1 of docs/phases/phase-8-multi-agent.md). `usage` is never populated:
 * a turn makes several LLM calls across different roles with no single
 * terminal response to attribute token usage to, so aggregating it was
 * left out of scope.
 */
interface MultiAgentLoopResult {
  reply: string;
  usage?: ChatResponse['usage'];
  multiAgentRun: MultiAgentRunInfo;
}

const GUARDRAIL_REFUSAL_TEXT =
  "I can't help with that request — it was flagged by an input safety check, so I didn't generate a response.";

const STRUCTURED_OUTPUT_SCHEMA_NAME = 'structured_answer';

const TOOL_LOOP_EXHAUSTED_TEXT =
  "I wasn't able to reach a final answer using the available tools within the allowed number of steps. Here's what I found so far, though it may be incomplete.";

const GRAPH_PENDING_APPROVAL_TEXT =
  "This turn is paused, waiting for approval on a sensitive action before it continues. Resume it via POST /api/v1/chat/graph/resume once you've decided.";

export class ChatService {
  constructor(
    private readonly chatModel: BaseChatModel,
    private readonly retrievalPipeline: RetrievalPipeline,
    private readonly historyStore: RedisChatMemoryStore,
    private readonly promptService: PromptService,
    private readonly toolExecutor: ToolExecutor,
    private readonly reactAgentRunner: ReactAgentRunner,
    private readonly graphAgentRunner: GraphAgentRunner,
    private readonly multiAgentRunner: MultiAgentRunner,
    private readonly semanticMemoryStore?: SemanticMemoryStore,
  ) {}

  public async invoke(request: ChatRequestInput): Promise<ChatResponse> {
    const sessionId = request.sessionId ?? randomUUID();
    const selection = toPromptSelection(request);
    const toolSelection = toToolSelection(request);
    const agentSelection = toAgentSelection(request);
    const graphSelection = toGraphSelection(request);
    const multiAgentSelection = toMultiAgentSelection(request);

    const [template, inputGuardrails] = await Promise.all([
      this.promptService.resolveVersion(selection.templateId, selection.version),
      Promise.resolve(runInputGuardrails(request.message)),
    ]);

    if (this.isBlocked(inputGuardrails)) {
      return this.buildBlockedResponse(sessionId, request.message, template, inputGuardrails);
    }

    const [{ chunks, retrieval }, memoryContext] = await Promise.all([
      this.retrieve(request.message, toRetrievalOptions(request)),
      this.prepareMemoryContext(sessionId, request.message),
    ]);

    const context = this.buildContext(chunks);
    const memoryBlock = this.buildMemoryBlock(memoryContext.semanticFacts);
    const summaryText = memoryContext.summary || 'None yet — this is a new conversation.';
    const memoryText = memoryBlock || 'None recorded.';
    const budgetPlan = this.computeBudget(
      this.promptOverheadTokens(template, selection.useFewShot),
      context,
      summaryText,
      memoryText,
      request.message,
    );
    const history = await trimHistory(memoryContext.rawMessages, budgetPlan.historyBudgetTokens);

    const chainInput: RagChainInput = {
      context,
      summary: summaryText,
      memory: memoryText,
      history,
      question: request.message,
    };

    // Computed once, up front — the graph branch stashes this on the
    // graph's own checkpointed state (§4 of docs/phases/phase-7-langgraph.md)
    // so a *resume* request (a brand new HTTP call, no local variables of
    // its own) can rebuild the exact same response shape later.
    const turnMeta: GraphTurnMeta = {
      question: request.message,
      citations: this.toCitations(chunks),
      retrieval,
      memory: this.buildMemoryInfo(history, budgetPlan, memoryContext),
      promptInfo: this.buildPromptInfo(template, selection, chainInput),
      hasContext: chunks.length > 0,
    };

    const generation = await this.generate(
      template,
      selection,
      chainInput,
      toolSelection,
      agentSelection,
      graphSelection,
      multiAgentSelection,
      sessionId,
      turnMeta,
    );

    if (generation.graphRun?.interrupted) {
      // The turn is paused, not finished — no history append, no output
      // guardrails, no `usage` yet. It'll all happen when the client
      // resumes via `POST /api/v1/chat/graph/resume` (§4).
      return {
        sessionId,
        reply: generation.reply,
        model: env.GROQ_MODEL,
        citations: turnMeta.citations,
        retrieval: turnMeta.retrieval,
        memory: turnMeta.memory,
        promptInfo: turnMeta.promptInfo,
        guardrails: { input: inputGuardrails, output: [], blocked: false },
        graphRun: generation.graphRun,
      };
    }

    await this.historyStore.appendTurn(
      sessionId,
      new HumanMessage(request.message),
      new AIMessage(generation.reply),
    );
    this.extractSemanticMemoryInBackground(sessionId, request.message, generation.reply);

    const outputGuardrails = runOutputGuardrails(generation.reply, {
      hasContext: chunks.length > 0,
      isStructuredOutput:
        selection.structuredOutput ||
        (generation.toolCalls?.length ?? 0) > 0 ||
        generation.agentRun !== undefined ||
        generation.multiAgentRun !== undefined,
    });

    return {
      sessionId,
      reply: generation.reply,
      model: env.GROQ_MODEL,
      citations: turnMeta.citations,
      retrieval: turnMeta.retrieval,
      memory: turnMeta.memory,
      promptInfo: turnMeta.promptInfo,
      guardrails: { input: inputGuardrails, output: outputGuardrails, blocked: false },
      ...(generation.structuredOutput ? { structuredOutput: generation.structuredOutput } : {}),
      ...(generation.toolCalls !== undefined ? { toolCalls: generation.toolCalls } : {}),
      ...(generation.agentRun !== undefined ? { agentRun: generation.agentRun } : {}),
      ...(generation.graphRun !== undefined ? { graphRun: generation.graphRun } : {}),
      ...(generation.multiAgentRun !== undefined
        ? { multiAgentRun: generation.multiAgentRun }
        : {}),
      ...(generation.usage ? { usage: generation.usage } : {}),
    };
  }

  /**
   * Resumes a turn paused by the `human_approval` node (§4). Mirrors
   * `invoke()`'s finalization tail — `turnMeta` is read back from the
   * graph's checkpointed state (this method has no local memory of the
   * original turn) instead of being computed fresh.
   */
  public async invokeResume(
    sessionId: string,
    decision: GraphResumeDecision,
  ): Promise<ChatResponse> {
    const result = await this.drainGraphLoop(this.generateWithGraphResume(sessionId, decision));
    const turnMeta = this.requireResumedTurnMeta(sessionId, result);

    if (result.graphRun.interrupted) {
      return {
        sessionId,
        reply: result.reply,
        model: env.GROQ_MODEL,
        citations: turnMeta.citations,
        retrieval: turnMeta.retrieval,
        memory: turnMeta.memory,
        promptInfo: turnMeta.promptInfo,
        guardrails: { input: [], output: [], blocked: false },
        graphRun: result.graphRun,
      };
    }

    await this.historyStore.appendTurn(
      sessionId,
      new HumanMessage(turnMeta.question),
      new AIMessage(result.reply),
    );
    this.extractSemanticMemoryInBackground(sessionId, turnMeta.question, result.reply);

    const outputGuardrails = runOutputGuardrails(result.reply, {
      hasContext: turnMeta.hasContext,
      isStructuredOutput: false,
    });

    return {
      sessionId,
      reply: result.reply,
      model: env.GROQ_MODEL,
      citations: turnMeta.citations,
      retrieval: turnMeta.retrieval,
      memory: turnMeta.memory,
      promptInfo: turnMeta.promptInfo,
      guardrails: { input: [], output: outputGuardrails, blocked: false },
      graphRun: result.graphRun,
      ...(result.usage ? { usage: result.usage } : {}),
    };
  }

  public async *stream({
    message,
    sessionId,
    retrievalOptions,
    promptTemplateId,
    promptVersion,
    useFewShot,
    structuredOutput,
    useTools,
    enabledTools,
    useAgent,
    useGraph,
    useMultiAgent,
    options,
  }: {
    message: string;
    sessionId?: string;
    retrievalOptions?: RetrievalOptions;
    promptTemplateId?: string;
    promptVersion?: number;
    useFewShot?: boolean;
    structuredOutput?: boolean;
    useTools?: boolean;
    enabledTools?: string[];
    useAgent?: boolean;
    useGraph?: boolean;
    useMultiAgent?: boolean;
    options?: StreamOptions;
  }): AsyncIterable<StreamChunk> {
    const sid = sessionId ?? randomUUID();
    const selection: PromptSelection = {
      templateId: promptTemplateId,
      version: promptVersion,
      useFewShot: useFewShot ?? false,
      structuredOutput: structuredOutput ?? false,
    };
    const toolSelection: ToolSelection = { useTools: useTools ?? false, enabledTools };
    const agentSelection: AgentSelection = { useAgent: useAgent ?? false, enabledTools };
    const graphSelection: GraphSelection = { useGraph: useGraph ?? false, enabledTools };
    const multiAgentSelection: MultiAgentSelection = {
      useMultiAgent: useMultiAgent ?? false,
      enabledTools,
    };

    const [template, inputGuardrails] = await Promise.all([
      this.promptService.resolveVersion(selection.templateId, selection.version),
      Promise.resolve(runInputGuardrails(message)),
    ]);

    if (this.isBlocked(inputGuardrails)) {
      yield* this.streamBlockedResponse(sid, message, template, inputGuardrails);
      return;
    }

    const [{ chunks, retrieval }, memoryContext] = await Promise.all([
      this.retrieve(message, retrievalOptions ?? {}),
      this.prepareMemoryContext(sid, message),
    ]);

    const citations = this.toCitations(chunks);

    yield { type: 'citations', sessionId: sid, citations, retrieval };

    const context = this.buildContext(chunks);
    const memoryBlock = this.buildMemoryBlock(memoryContext.semanticFacts);
    const summaryText = memoryContext.summary || 'None yet — this is a new conversation.';
    const memoryText = memoryBlock || 'None recorded.';
    const budgetPlan = this.computeBudget(
      this.promptOverheadTokens(template, selection.useFewShot),
      context,
      summaryText,
      memoryText,
      message,
    );
    const history = await trimHistory(memoryContext.rawMessages, budgetPlan.historyBudgetTokens);

    const chainInput: RagChainInput = {
      context,
      summary: summaryText,
      memory: memoryText,
      history,
      question: message,
    };

    // Computed once, up front (moved earlier than the original `done`-only
    // computation) so the graph branch below can stash them as `turnMeta`
    // for a later resume request to read back (§4 of
    // docs/phases/phase-7-langgraph.md).
    const memoryInfo = this.buildMemoryInfo(history, budgetPlan, memoryContext);
    const promptInfoObj = this.buildPromptInfo(template, selection, chainInput);

    let fullText: string;
    let usage: ChatResponse['usage'];
    let structuredOutputInfo: StructuredOutputInfo | undefined;
    let toolCallsInfo: ToolCallInfo[] | undefined;
    let agentRunInfo: AgentRunInfo | undefined;
    let graphRunInfo: GraphRunInfo | undefined;
    let multiAgentRunInfo: MultiAgentRunInfo | undefined;

    if (multiAgentSelection.useMultiAgent) {
      // Same non-streaming-internally, live-events-forwarded shape as the
      // graph/agent/tool branches below — the final answer is
      // token-streamed as one chunk, real-time progress instead comes from
      // the `agent_turn_start`/`agent_turn_end` events (§1/§4 of
      // docs/phases/phase-8-multi-agent.md).
      const loop = this.generateWithMultiAgent(chainInput, sid, multiAgentSelection);
      let step = await loop.next();

      while (!step.done) {
        const event = step.value;
        yield { type: event.type, sessionId: sid, agentTurn: event.turn };
        step = await loop.next();
      }

      const result = step.value;
      fullText = result.reply;
      usage = result.usage;
      multiAgentRunInfo = result.multiAgentRun;

      yield { type: 'token', sessionId: sid, text: fullText };
    } else if (graphSelection.useGraph) {
      const turnMeta: GraphTurnMeta = {
        question: message,
        citations,
        retrieval,
        memory: memoryInfo,
        promptInfo: promptInfoObj,
        hasContext: chunks.length > 0,
      };

      const loop = this.generateWithGraph(chainInput, sid, graphSelection, turnMeta);
      let step = await loop.next();

      while (!step.done) {
        const event = step.value;
        yield {
          type: event.type,
          sessionId: sid,
          graphNode: event.node,
        };
        step = await loop.next();
      }

      const result = step.value;

      if (result.graphRun.interrupted) {
        yield {
          type: 'graph_interrupt',
          sessionId: sid,
          ...(result.graphRun.pendingApproval
            ? { graphInterrupt: result.graphRun.pendingApproval }
            : {}),
        };
        // Paused, not finished — no history append, no `done` (§4). The
        // client resumes via `streamResume()`, which runs this same
        // finalization tail once the graph actually completes.
        return;
      }

      fullText = result.reply;
      usage = result.usage;
      graphRunInfo = result.graphRun;

      yield { type: 'token', sessionId: sid, text: fullText };
    } else if (agentSelection.useAgent) {
      // Same non-streaming-internally, live-events-forwarded shape as the
      // tool loop below — only the final answer is token-streamed as one
      // chunk; real-time progress instead comes from the
      // `agent_plan`/`agent_thought`/`agent_observation` events (§4 of
      // docs/phases/phase-6-agents.md).
      const loop = this.generateWithAgent(chainInput, agentSelection);
      let step = await loop.next();

      while (!step.done) {
        const event = step.value;
        if (event.type === 'agent_plan') {
          yield { type: 'agent_plan', sessionId: sid, agentPlan: event.plan };
        } else if (event.type === 'agent_thought') {
          yield { type: 'agent_thought', sessionId: sid, agentStep: event.step };
        } else {
          yield { type: 'agent_observation', sessionId: sid, agentObservation: event.step };
        }
        step = await loop.next();
      }

      fullText = step.value.reply;
      usage = step.value.usage;
      agentRunInfo = step.value.agentRun;

      yield { type: 'token', sessionId: sid, text: fullText };
    } else if (toolSelection.useTools) {
      // Like structured output below, the tool loop always runs
      // non-streaming internally (each intermediate model decision isn't
      // meaningful to stream token-by-token) — but unlike structured
      // output, it yields live `tool_call`/`tool_result` events as they
      // happen, so the UI still gets real-time progress (§4).
      const loop = this.generateWithTools(template, chainInput, toolSelection);
      let step = await loop.next();

      while (!step.done) {
        const event = step.value;
        if (event.type === 'tool_call') {
          yield { type: 'tool_call', sessionId: sid, toolCall: event.toolCall };
        } else {
          yield { type: 'tool_result', sessionId: sid, toolResult: event.toolResult };
        }
        step = await loop.next();
      }

      fullText = step.value.reply;
      usage = step.value.usage;
      toolCallsInfo = step.value.toolCalls;

      yield { type: 'token', sessionId: sid, text: fullText };
    } else if (selection.structuredOutput) {
      // Structured output can't be safely streamed token-by-token (the JSON
      // isn't valid until the final token) — one non-streaming call, then
      // emitted as a single `token` event, keeping the SSE contract
      // (citations → token → done) unchanged for the client (§4).
      const generation = await this.generateStructured(template, chainInput, options);
      fullText = generation.reply;
      usage = generation.usage;
      structuredOutputInfo = generation.structuredOutput;

      yield { type: 'token', sessionId: sid, text: fullText };
    } else {
      const prompt = buildDynamicPrompt(template, { useFewShot: selection.useFewShot });
      const chain = prompt.pipe(this.chatModel);

      let aggregated: AIMessageChunk | undefined;
      fullText = '';

      const streamIterable = await chain.stream(
        chainInput,
        options?.signal ? { signal: options.signal } : {},
      );

      for await (const part of streamIterable) {
        aggregated = aggregated ? concat(aggregated, part) : part;

        if (part.text) {
          fullText += part.text;
          yield { type: 'token', sessionId: sid, text: part.text };
        }
      }

      usage = aggregated?.usage_metadata;
    }

    await this.historyStore.appendTurn(sid, new HumanMessage(message), new AIMessage(fullText));
    this.extractSemanticMemoryInBackground(sid, message, fullText);

    const outputGuardrails = runOutputGuardrails(fullText, {
      hasContext: chunks.length > 0,
      isStructuredOutput:
        selection.structuredOutput ||
        (toolCallsInfo?.length ?? 0) > 0 ||
        agentRunInfo !== undefined ||
        multiAgentRunInfo !== undefined,
    });

    yield {
      type: 'done',
      sessionId: sid,
      model: env.GROQ_MODEL,
      memory: memoryInfo,
      promptInfo: promptInfoObj,
      guardrails: { input: inputGuardrails, output: outputGuardrails, blocked: false },
      ...(structuredOutputInfo ? { structuredOutput: structuredOutputInfo } : {}),
      ...(toolCallsInfo !== undefined ? { toolCalls: toolCallsInfo } : {}),
      ...(agentRunInfo !== undefined ? { agentRun: agentRunInfo } : {}),
      ...(graphRunInfo !== undefined ? { graphRun: graphRunInfo } : {}),
      ...(multiAgentRunInfo !== undefined ? { multiAgentRun: multiAgentRunInfo } : {}),
      ...(usage ? { usage } : {}),
    };
  }

  /**
   * Resumes a turn paused by the `human_approval` node (§4), streaming the
   * same live `graph_node_start`/`graph_node_end` progress `stream()`'s
   * graph branch does, then running the same finalization tail as a
   * normal turn once the graph actually completes.
   */
  public async *streamResume(
    sessionId: string,
    decision: GraphResumeDecision,
  ): AsyncIterable<StreamChunk> {
    const loop = this.generateWithGraphResume(sessionId, decision);
    let step = await loop.next();

    while (!step.done) {
      const event = step.value;
      yield { type: event.type, sessionId, graphNode: event.node };
      step = await loop.next();
    }

    const result = step.value;

    if (result.graphRun.interrupted) {
      yield {
        type: 'graph_interrupt',
        sessionId,
        ...(result.graphRun.pendingApproval
          ? { graphInterrupt: result.graphRun.pendingApproval }
          : {}),
      };
      return;
    }

    const turnMeta = this.requireResumedTurnMeta(sessionId, result);
    yield { type: 'token', sessionId, text: result.reply };

    await this.historyStore.appendTurn(
      sessionId,
      new HumanMessage(turnMeta.question),
      new AIMessage(result.reply),
    );
    this.extractSemanticMemoryInBackground(sessionId, turnMeta.question, result.reply);

    const outputGuardrails = runOutputGuardrails(result.reply, {
      hasContext: turnMeta.hasContext,
      isStructuredOutput: false,
    });

    yield {
      type: 'done',
      sessionId,
      model: env.GROQ_MODEL,
      memory: turnMeta.memory,
      promptInfo: turnMeta.promptInfo,
      guardrails: { input: [], output: outputGuardrails, blocked: false },
      graphRun: result.graphRun,
      ...(result.usage ? { usage: result.usage } : {}),
    };
  }

  /**
   * Runs the model call for a turn — either the normal streaming-capable
   * prose chain, or (when `structuredOutput` was requested) one
   * non-streaming `withStructuredOutput` call (§4).
   */
  private async generate(
    template: PromptResolvedTemplate,
    selection: PromptSelection,
    chainInput: RagChainInput,
    toolSelection: ToolSelection,
    agentSelection: AgentSelection,
    graphSelection: GraphSelection,
    multiAgentSelection: MultiAgentSelection,
    sessionId: string,
    turnMeta: GraphTurnMeta,
  ): Promise<{
    reply: string;
    usage: ChatResponse['usage'];
    structuredOutput?: StructuredOutputInfo;
    toolCalls?: ToolCallInfo[];
    agentRun?: AgentRunInfo;
    graphRun?: GraphRunInfo;
    multiAgentRun?: MultiAgentRunInfo;
  }> {
    // Mutually exclusive per turn — useMultiAgent > useGraph > useAgent >
    // useTools > structuredOutput if more than one is requested (§4 of
    // docs/phases/phase-8-multi-agent.md).
    if (multiAgentSelection.useMultiAgent) {
      const loop = this.generateWithMultiAgent(chainInput, sessionId, multiAgentSelection);
      let step = await loop.next();
      while (!step.done) {
        step = await loop.next();
      }
      const result = step.value;
      return { reply: result.reply, usage: result.usage, multiAgentRun: result.multiAgentRun };
    }

    if (graphSelection.useGraph) {
      const loop = this.generateWithGraph(chainInput, sessionId, graphSelection, turnMeta);
      const result = await this.drainGraphLoop(loop);
      return { reply: result.reply, usage: result.usage, graphRun: result.graphRun };
    }

    if (agentSelection.useAgent) {
      const loop = this.generateWithAgent(chainInput, agentSelection);
      let step = await loop.next();
      while (!step.done) {
        step = await loop.next();
      }
      return step.value;
    }

    if (toolSelection.useTools) {
      const loop = this.generateWithTools(template, chainInput, toolSelection);
      let step = await loop.next();
      while (!step.done) {
        step = await loop.next();
      }
      return step.value;
    }

    if (selection.structuredOutput) {
      return this.generateStructured(template, chainInput);
    }

    const prompt = buildDynamicPrompt(template, { useFewShot: selection.useFewShot });
    const response = await prompt.pipe(this.chatModel).invoke(chainInput);

    return { reply: response.text, usage: response.usage_metadata };
  }

  /**
   * The bind-tools execute-loop (§4 of docs/phases/phase-5-tools.md): bind
   * the enabled tools, call the model, and if it asks for tool calls,
   * execute each one (via `ToolExecutor`, so timeout/error handling is
   * shared), feed the results back as `ToolMessage`s, and repeat — up to
   * `TOOLS_MAX_ITERATIONS`. Yields a `ToolLoopEvent` the instant each call
   * starts and right after it finishes, so the streaming path can forward
   * live progress; `invoke()`'s non-streaming path just drains the
   * generator and keeps its final return value. Exceeding the iteration
   * cap falls back to the last response's text (or a canned message),
   * mirroring `GUARDRAIL_REFUSAL_TEXT`'s pattern.
   */
  private async *generateWithTools(
    template: PromptResolvedTemplate,
    chainInput: RagChainInput,
    toolSelection: ToolSelection,
  ): AsyncGenerator<ToolLoopEvent, ToolLoopResult, void> {
    if (typeof this.chatModel.bindTools !== 'function') {
      throw new Error('The configured chat model does not support tool calling.');
    }

    const prompt = buildDynamicPrompt(template, { useFewShot: false });
    const messages: BaseMessage[] = await prompt.formatMessages(chainInput);
    const bindableTools = this.toolExecutor.getBindableTools(toolSelection.enabledTools);
    const modelWithTools = this.chatModel.bindTools(bindableTools);

    const toolCalls: ToolCallInfo[] = [];
    let lastReply = '';
    let usage: ChatResponse['usage'];

    for (let iteration = 0; iteration < env.TOOLS_MAX_ITERATIONS; iteration++) {
      const response = await modelWithTools.invoke(messages);
      usage = response.usage_metadata ?? usage;
      lastReply = response.text;
      messages.push(response);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        return { reply: response.text, usage, toolCalls };
      }

      for (const call of response.tool_calls) {
        const id = call.id ?? randomUUID();

        yield { type: 'tool_call', toolCall: { id, name: call.name, args: call.args } };

        const result = await this.toolExecutor.execute({ id, name: call.name, args: call.args });
        toolCalls.push(result);

        yield { type: 'tool_result', toolResult: result };

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

    return {
      reply: lastReply.trim().length > 0 ? lastReply : TOOL_LOOP_EXHAUSTED_TEXT,
      usage,
      toolCalls,
    };
  }

  /**
   * The ReAct agent loop (§3/§4 of docs/phases/phase-6-agents.md) —
   * delegates to `ReactAgentRunner.run()`, which plans then loops
   * Thought/Action/Action Input/Observation via plain-text model calls
   * (deliberately not `bindTools`, contrasting with `generateWithTools()`
   * above). Only forwards `context`/`summary`/`memory` from `chainInput`
   * (not `history` — the agent's own scratchpad plus the summary/memory
   * blocks stand in for cross-turn context here, a documented
   * simplification). Yields the same shape of live events
   * `generateWithTools()` does, so the streaming path can forward
   * `agent_plan`/`agent_thought`/`agent_observation` progress identically.
   */
  private async *generateWithAgent(
    chainInput: RagChainInput,
    agentSelection: AgentSelection,
  ): AsyncGenerator<AgentLoopEvent, AgentLoopResult, void> {
    const loop = this.reactAgentRunner.run(
      chainInput.question,
      { context: chainInput.context, summary: chainInput.summary, memory: chainInput.memory },
      { enabledTools: agentSelection.enabledTools },
    );

    let step = await loop.next();
    while (!step.done) {
      yield step.value;
      step = await loop.next();
    }

    return step.value;
  }

  /**
   * The LangGraph agent<->tools loop (§3/§4 of docs/phases/phase-7-langgraph.md)
   * — delegates to `GraphAgentRunner.run()`, then wraps its raw result
   * into the same `GraphLoopEvent`/`GraphLoopResult` shape
   * `generateWithGraphResume()` below produces, so both `stream()`'s graph
   * branch and `streamResume()` can share identical event-forwarding code.
   * Only forwards `context`/`summary`/`memory` from `chainInput` (not
   * `history`) — same documented simplification as `generateWithAgent()`.
   */
  private async *generateWithGraph(
    chainInput: RagChainInput,
    sessionId: string,
    graphSelection: GraphSelection,
    turnMeta: GraphTurnMeta,
  ): AsyncGenerator<GraphLoopEvent, GraphLoopResult, void> {
    const loop = this.graphAgentRunner.run(
      {
        question: chainInput.question,
        context: chainInput.context,
        summary: chainInput.summary,
        memory: chainInput.memory,
      },
      sessionId,
      graphSelection.enabledTools,
      turnMeta as unknown as Record<string, unknown>,
    );

    return yield* this.toGraphLoopResult(loop, sessionId);
  }

  /**
   * The Phase 8 supervisor-graph loop (§1/§4 of
   * docs/phases/phase-8-multi-agent.md) — delegates to
   * `MultiAgentRunner.run()`, forwarding its live `agent_turn_start`/
   * `agent_turn_end` events unchanged. Simpler than `generateWithGraph()`:
   * there's no interrupt branch to wrap, since a multi-agent turn always
   * runs to completion in one call. Only forwards `context`/`summary`/
   * `memory` from `chainInput` (not `history`) — same documented
   * simplification as `generateWithAgent()`/`generateWithGraph()`.
   */
  private async *generateWithMultiAgent(
    chainInput: RagChainInput,
    sessionId: string,
    multiAgentSelection: MultiAgentSelection,
  ): AsyncGenerator<MultiAgentLoopEvent, MultiAgentLoopResult, void> {
    const loop = this.multiAgentRunner.run(
      {
        question: chainInput.question,
        context: chainInput.context,
        summary: chainInput.summary,
        memory: chainInput.memory,
      },
      sessionId,
      multiAgentSelection.enabledTools,
    );

    let step = await loop.next();
    while (!step.done) {
      yield step.value;
      step = await loop.next();
    }

    const result = step.value;
    return { reply: result.reply, multiAgentRun: result.multiAgentRun };
  }

  /** Resumes a paused run (§4) — same wrapping as `generateWithGraph()` above, just against `GraphAgentRunner.resume()` instead of `.run()`. */
  private async *generateWithGraphResume(
    sessionId: string,
    decision: GraphResumeDecision,
  ): AsyncGenerator<GraphLoopEvent, GraphLoopResult, void> {
    const loop = this.graphAgentRunner.resume(sessionId, decision);
    return yield* this.toGraphLoopResult(loop, sessionId);
  }

  /**
   * Forwards a `GraphAgentRunner` generator's live events unchanged, and
   * turns its raw `GraphRunResult` return value into the fully-built
   * `GraphRunInfo` (`ChatResponse.graphRun`) shape both `run()` and
   * `resume()` callers need.
   */
  private async *toGraphLoopResult(
    loop: AsyncGenerator<
      GraphLoopEvent,
      {
        interrupted: boolean;
        reply?: string;
        usage?: ChatResponse['usage'];
        nodes: GraphNodeInfo[];
        pendingApproval?: PendingApprovalInfo;
        turnMeta?: Record<string, unknown>;
      },
      void
    >,
    sessionId: string,
  ): AsyncGenerator<GraphLoopEvent, GraphLoopResult, void> {
    let step = await loop.next();
    while (!step.done) {
      yield step.value;
      step = await loop.next();
    }

    const result = step.value;
    const graphRun: GraphRunInfo = {
      nodes: result.nodes,
      interrupted: result.interrupted,
      threadId: sessionId,
      ...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {}),
    };

    return {
      reply: result.interrupted ? GRAPH_PENDING_APPROVAL_TEXT : (result.reply ?? ''),
      graphRun,
      ...(result.usage ? { usage: result.usage } : {}),
      ...(result.turnMeta ? { resumedTurnMeta: result.turnMeta as unknown as GraphTurnMeta } : {}),
    };
  }

  /** Fully drains any of the above generators for the non-streaming (`invoke()`) path, discarding live events and keeping only the final result. */
  private async drainGraphLoop<T>(loop: AsyncGenerator<GraphLoopEvent, T, void>): Promise<T> {
    let step = await loop.next();
    while (!step.done) {
      step = await loop.next();
    }
    return step.value;
  }

  /**
   * A resume request has no local memory of the original turn — `turnMeta`
   * only exists because `generateWithGraph()` stashed it on the graph's
   * own checkpointed state. Its absence means `sessionId` never had a
   * graph run in the first place (or its checkpoint expired/was evicted).
   */
  private requireResumedTurnMeta(sessionId: string, result: GraphLoopResult): GraphTurnMeta {
    if (!result.resumedTurnMeta) {
      throw new Error(
        `No paused graph run found for session "${sessionId}" — it may have already completed, expired, or never existed.`,
      );
    }
    return result.resumedTurnMeta;
  }

  /**
   * `withStructuredOutput` is what demonstrates both "JSON mode" (the
   * wire-level `response_format` mechanism it configures on the model
   * request) and "output parsers" (the Zod validation layer that turns the
   * raw JSON string back into a typed, validated object) together in a
   * single LangChain call — see `extract-memory-facts.ts` for the
   * hand-rolled, lower-level equivalent already elsewhere in this codebase.
   *
   * Fails closed on any parse/validation error: the client still gets a
   * normal chat reply (a short apology) plus `structuredOutput.valid: false`,
   * rather than a 500.
   */
  private async generateStructured(
    template: PromptResolvedTemplate,
    chainInput: RagChainInput,
    options?: StreamOptions,
  ): Promise<{
    reply: string;
    usage: ChatResponse['usage'];
    structuredOutput: StructuredOutputInfo;
  }> {
    const prompt = buildDynamicPrompt(template, { useFewShot: false });
    const structuredModel = this.chatModel.withStructuredOutput<StructuredAnswer>(
      STRUCTURED_ANSWER_SCHEMA,
      { includeRaw: true, name: STRUCTURED_OUTPUT_SCHEMA_NAME },
    );

    try {
      const { raw, parsed } = await prompt
        .pipe(structuredModel)
        .invoke(chainInput, options?.signal ? { signal: options.signal } : {});

      return {
        reply: parsed.answer,
        usage: (raw as AIMessage).usage_metadata,
        structuredOutput: { schemaName: STRUCTURED_OUTPUT_SCHEMA_NAME, data: parsed, valid: true },
      };
    } catch (error) {
      logger.error({ error }, 'Structured output generation failed');

      return {
        reply: 'Sorry, I was unable to produce a structured answer for this request.',
        usage: undefined,
        structuredOutput: {
          schemaName: STRUCTURED_OUTPUT_SCHEMA_NAME,
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  }

  private isBlocked(inputGuardrails: GuardrailResult[]): boolean {
    return (
      env.PROMPT_GUARDRAILS_MODE === 'block' && inputGuardrails.some((result) => !result.passed)
    );
  }

  /**
   * Short-circuits before retrieval or any LLM call (§5) — the reply is a
   * synthesized refusal, but still recorded to history like any other turn
   * so the conversation stays consistent, and memory/token-budget numbers
   * still reflect reality for the next turn.
   */
  private async buildBlockedResponse(
    sessionId: string,
    message: string,
    template: PromptResolvedTemplate,
    inputGuardrails: GuardrailResult[],
  ): Promise<ChatResponse> {
    const memoryContext = await this.prepareMemoryContext(sessionId, message);
    const summaryText = memoryContext.summary || 'None yet — this is a new conversation.';
    const budgetPlan = this.computeBudget(
      this.promptOverheadTokens(template, false),
      '',
      summaryText,
      '',
      message,
    );
    const history = await trimHistory(memoryContext.rawMessages, budgetPlan.historyBudgetTokens);

    await this.historyStore.appendTurn(
      sessionId,
      new HumanMessage(message),
      new AIMessage(GUARDRAIL_REFUSAL_TEXT),
    );

    return {
      sessionId,
      reply: GUARDRAIL_REFUSAL_TEXT,
      model: env.GROQ_MODEL,
      citations: [],
      retrieval: { strategy: 'skipped', stages: [] },
      memory: this.buildMemoryInfo(history, budgetPlan, memoryContext),
      promptInfo: this.buildPromptInfo(
        template,
        { useFewShot: false },
        {
          context: '',
          summary: summaryText,
          memory: '',
          history,
          question: message,
        },
      ),
      guardrails: { input: inputGuardrails, output: [], blocked: true },
    };
  }

  private async *streamBlockedResponse(
    sessionId: string,
    message: string,
    template: PromptResolvedTemplate,
    inputGuardrails: GuardrailResult[],
  ): AsyncIterable<StreamChunk> {
    yield {
      type: 'citations',
      sessionId,
      citations: [],
      retrieval: { strategy: 'skipped', stages: [] },
    };

    const memoryContext = await this.prepareMemoryContext(sessionId, message);
    const summaryText = memoryContext.summary || 'None yet — this is a new conversation.';
    const budgetPlan = this.computeBudget(
      this.promptOverheadTokens(template, false),
      '',
      summaryText,
      '',
      message,
    );
    const history = await trimHistory(memoryContext.rawMessages, budgetPlan.historyBudgetTokens);

    yield { type: 'token', sessionId, text: GUARDRAIL_REFUSAL_TEXT };

    await this.historyStore.appendTurn(
      sessionId,
      new HumanMessage(message),
      new AIMessage(GUARDRAIL_REFUSAL_TEXT),
    );

    yield {
      type: 'done',
      sessionId,
      model: env.GROQ_MODEL,
      memory: this.buildMemoryInfo(history, budgetPlan, memoryContext),
      promptInfo: this.buildPromptInfo(
        template,
        { useFewShot: false },
        {
          context: '',
          summary: summaryText,
          memory: '',
          history,
          question: message,
        },
      ),
      guardrails: { input: inputGuardrails, output: [], blocked: true },
    };
  }

  private async retrieve(
    query: string,
    options: RetrievalOptions,
  ): Promise<{ chunks: RetrievedChunk[]; retrieval: RetrievalInfo }> {
    const result = await this.retrievalPipeline.retrieve(query, options);

    return {
      chunks: result.chunks,
      retrieval: { strategy: result.strategyUsed, stages: result.stages },
    };
  }

  private buildContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant context was found in the knowledge base.';
    }

    return chunks
      .map((chunk, i) => `[${i + 1}] (source: ${chunk.source})\n${chunk.content}`)
      .join('\n\n');
  }

  private toCitations(chunks: RetrievedChunk[]): ChatCitation[] {
    return chunks.map((chunk, i) => ({
      index: i + 1,
      source: chunk.source,
      ...(chunk.title ? { title: chunk.title } : {}),
      score: chunk.score,
      snippet: chunk.content.length > 200 ? `${chunk.content.slice(0, 200)}…` : chunk.content,
      content: chunk.content,
      ...(chunk.category ? { category: chunk.category } : {}),
      ...(chunk.docType ? { docType: chunk.docType } : {}),
    }));
  }

  /**
   * Loads a session's memory and, if §5's trigger fires, folds the oldest
   * messages into the rolling summary and compacts them out of Redis —
   * *before* this turn's retrieval/generation, so the check is always
   * based on history as of the *previous* turn (docs/phases/phase-3-memory.md §5).
   */
  private async prepareMemoryContext(sessionId: string, question: string): Promise<MemoryContext> {
    const { messages, summary: storedSummary } = await this.historyStore.load(sessionId);

    let summary = storedSummary;
    let summarized = false;
    let rawMessages = messages;

    if (
      messages.length > env.MEMORY_RECENT_MESSAGES_KEPT &&
      countMessageTokens(messages) > env.MEMORY_SUMMARY_TRIGGER_TOKENS
    ) {
      const cutoffIndex = messages.length - env.MEMORY_RECENT_MESSAGES_KEPT;
      const toSummarize = messages.slice(0, cutoffIndex);
      const toKeep = messages.slice(cutoffIndex);

      summary = await summarizeHistory(this.chatModel, storedSummary, toSummarize);
      await this.historyStore.compact(sessionId, env.MEMORY_RECENT_MESSAGES_KEPT, summary);

      rawMessages = toKeep;
      summarized = true;
    }

    const semanticFacts = this.semanticMemoryStore
      ? await this.semanticMemoryStore.search(sessionId, question)
      : [];

    return { rawMessages, summary, summarized, semanticFacts };
  }

  private computeBudget(
    promptOverheadTokens: number,
    context: string,
    summary: string,
    memoryBlock: string,
    question: string,
  ): TokenBudgetPlan {
    return computeHistoryBudget({
      systemPromptTokens: promptOverheadTokens,
      context,
      summary,
      memory: memoryBlock,
      question,
    });
  }

  /**
   * Token cost of the *selected* template's static text (placeholders
   * stripped, since those are replaced before the model ever sees them),
   * plus few-shot examples' cost when they're actually spliced in — the
   * per-template replacement for Phase 3's fixed, module-level
   * `SYSTEM_PROMPT_STATIC_TOKENS` constant, since that text now varies
   * per-request (§6).
   */
  private promptOverheadTokens(template: PromptResolvedTemplate, useFewShot: boolean): number {
    let tokens = countTokens(template.systemPrompt.replace(/\{\w+\}/g, ''));

    if (useFewShot) {
      for (const example of template.fewShotExamples) {
        tokens += countTokens(example.input) + countTokens(example.output);
      }
    }

    return tokens;
  }

  private buildMemoryBlock(facts: readonly SemanticFact[]): string {
    if (facts.length === 0) {
      return '';
    }

    return facts.map((fact) => `- ${fact.text}`).join('\n');
  }

  private buildMemoryInfo(
    history: BaseMessage[],
    budgetPlan: TokenBudgetPlan,
    memoryContext: MemoryContext,
  ): MemoryInfo {
    const historyTokensUsed = countMessageTokens(history);

    return {
      historyMessageCount: history.length,
      historyTokens: historyTokensUsed,
      summarized: memoryContext.summarized,
      ...(memoryContext.summary ? { summary: memoryContext.summary } : {}),
      tokenBudget: { ...budgetPlan, historyTokensUsed },
      semanticFacts: memoryContext.semanticFacts,
    };
  }

  private buildPromptInfo(
    template: PromptResolvedTemplate,
    selection: Pick<PromptSelection, 'useFewShot'>,
    chainInput: RagChainInput,
  ): PromptInfo {
    return {
      templateId: template.templateId,
      templateName: template.templateName,
      version: template.version,
      usedFewShot: selection.useFewShot && template.fewShotExamples.length > 0,
      variables: {
        context: chainInput.context,
        summary: chainInput.summary,
        memory: chainInput.memory,
        question: chainInput.question,
      },
    };
  }

  /**
   * Fact extraction (§7.1) runs *after* the turn's response is already
   * being returned/streamed — deliberately not awaited, so an extra LLM
   * call for a feature that's off by default never adds latency to the
   * chat response itself. Failures are logged, never surfaced to the client.
   */
  private extractSemanticMemoryInBackground(
    sessionId: string,
    question: string,
    reply: string,
  ): void {
    const store = this.semanticMemoryStore;
    if (!store) {
      return;
    }

    extractMemoryFacts(this.chatModel, question, reply)
      .then((facts) => store.save(sessionId, facts))
      .catch((error: unknown) => {
        logger.error({ error, sessionId }, 'Semantic memory fact extraction failed');
      });
  }
}

interface RetrievalOptionsSource {
  retrievalStrategy?: string | undefined;
  filters?: RetrievalOptions['filter'] | undefined;
  useMmr?: boolean | undefined;
  useRerank?: boolean | undefined;
  useCompression?: boolean | undefined;
  useQueryExpansion?: boolean | undefined;
}

/**
 * Maps the wire-level chat request fields (shared between the JSON body and
 * the SSE query string) onto the retrieval pipeline's option shape.
 */
export function toRetrievalOptions(request: RetrievalOptionsSource): RetrievalOptions {
  return {
    ...(request.retrievalStrategy
      ? { strategy: request.retrievalStrategy as RetrievalStrategy }
      : {}),
    ...(request.filters ? { filter: request.filters } : {}),
    ...(request.useMmr !== undefined ? { useMmr: request.useMmr } : {}),
    ...(request.useRerank !== undefined ? { useRerank: request.useRerank } : {}),
    ...(request.useCompression !== undefined ? { useCompression: request.useCompression } : {}),
    ...(request.useQueryExpansion !== undefined
      ? { useQueryExpansion: request.useQueryExpansion }
      : {}),
  };
}

interface PromptSelectionSource {
  promptTemplateId?: string | undefined;
  promptVersion?: number | undefined;
  useFewShot?: boolean | undefined;
  structuredOutput?: boolean | undefined;
}

function toPromptSelection(request: PromptSelectionSource): PromptSelection {
  return {
    templateId: request.promptTemplateId,
    version: request.promptVersion,
    useFewShot: request.useFewShot ?? false,
    structuredOutput: request.structuredOutput ?? false,
  };
}

interface ToolSelectionSource {
  useTools?: boolean | undefined;
  enabledTools?: string[] | undefined;
}

function toToolSelection(request: ToolSelectionSource): ToolSelection {
  return {
    useTools: request.useTools ?? false,
    enabledTools: request.enabledTools,
  };
}

interface AgentSelectionSource {
  useAgent?: boolean | undefined;
  enabledTools?: string[] | undefined;
}

function toAgentSelection(request: AgentSelectionSource): AgentSelection {
  return {
    useAgent: request.useAgent ?? false,
    enabledTools: request.enabledTools,
  };
}

interface GraphSelectionSource {
  useGraph?: boolean | undefined;
  enabledTools?: string[] | undefined;
}

function toGraphSelection(request: GraphSelectionSource): GraphSelection {
  return {
    useGraph: request.useGraph ?? false,
    enabledTools: request.enabledTools,
  };
}

interface MultiAgentSelectionSource {
  useMultiAgent?: boolean | undefined;
  enabledTools?: string[] | undefined;
}

function toMultiAgentSelection(request: MultiAgentSelectionSource): MultiAgentSelection {
  return {
    useMultiAgent: request.useMultiAgent ?? false,
    enabledTools: request.enabledTools,
  };
}
