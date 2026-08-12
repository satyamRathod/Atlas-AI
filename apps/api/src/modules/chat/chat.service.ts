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

/** One `tool_call`/`tool_result` pair as it happens, mid-loop — what `generateWithTools()` yields so the streaming path can forward it live. */
type ToolLoopEvent =
  | { type: 'tool_call'; toolCall: ToolCallStart }
  | { type: 'tool_result'; toolResult: ToolCallInfo };

interface ToolLoopResult {
  reply: string;
  usage: ChatResponse['usage'];
  toolCalls: ToolCallInfo[];
}

const GUARDRAIL_REFUSAL_TEXT =
  "I can't help with that request — it was flagged by an input safety check, so I didn't generate a response.";

const STRUCTURED_OUTPUT_SCHEMA_NAME = 'structured_answer';

const TOOL_LOOP_EXHAUSTED_TEXT =
  "I wasn't able to reach a final answer using the available tools within the allowed number of steps. Here's what I found so far, though it may be incomplete.";

export class ChatService {
  constructor(
    private readonly chatModel: BaseChatModel,
    private readonly retrievalPipeline: RetrievalPipeline,
    private readonly historyStore: RedisChatMemoryStore,
    private readonly promptService: PromptService,
    private readonly toolExecutor: ToolExecutor,
    private readonly semanticMemoryStore?: SemanticMemoryStore,
  ) {}

  public async invoke(request: ChatRequestInput): Promise<ChatResponse> {
    const sessionId = request.sessionId ?? randomUUID();
    const selection = toPromptSelection(request);
    const toolSelection = toToolSelection(request);

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

    const generation = await this.generate(template, selection, chainInput, toolSelection);

    await this.historyStore.appendTurn(
      sessionId,
      new HumanMessage(request.message),
      new AIMessage(generation.reply),
    );
    this.extractSemanticMemoryInBackground(sessionId, request.message, generation.reply);

    const outputGuardrails = runOutputGuardrails(generation.reply, {
      hasContext: chunks.length > 0,
      isStructuredOutput: selection.structuredOutput || (generation.toolCalls?.length ?? 0) > 0,
    });

    return {
      sessionId,
      reply: generation.reply,
      model: env.GROQ_MODEL,
      citations: this.toCitations(chunks),
      retrieval,
      memory: this.buildMemoryInfo(history, budgetPlan, memoryContext),
      promptInfo: this.buildPromptInfo(template, selection, chainInput),
      guardrails: { input: inputGuardrails, output: outputGuardrails, blocked: false },
      ...(generation.structuredOutput ? { structuredOutput: generation.structuredOutput } : {}),
      ...(generation.toolCalls !== undefined ? { toolCalls: generation.toolCalls } : {}),
      ...(generation.usage ? { usage: generation.usage } : {}),
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

    let fullText: string;
    let usage: ChatResponse['usage'];
    let structuredOutputInfo: StructuredOutputInfo | undefined;
    let toolCallsInfo: ToolCallInfo[] | undefined;

    if (toolSelection.useTools) {
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
      isStructuredOutput: selection.structuredOutput || (toolCallsInfo?.length ?? 0) > 0,
    });

    yield {
      type: 'done',
      sessionId: sid,
      model: env.GROQ_MODEL,
      memory: this.buildMemoryInfo(history, budgetPlan, memoryContext),
      promptInfo: this.buildPromptInfo(template, selection, chainInput),
      guardrails: { input: inputGuardrails, output: outputGuardrails, blocked: false },
      ...(structuredOutputInfo ? { structuredOutput: structuredOutputInfo } : {}),
      ...(toolCallsInfo !== undefined ? { toolCalls: toolCallsInfo } : {}),
      ...(usage ? { usage } : {}),
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
  ): Promise<{
    reply: string;
    usage: ChatResponse['usage'];
    structuredOutput?: StructuredOutputInfo;
    toolCalls?: ToolCallInfo[];
  }> {
    // Mutually exclusive per turn — combining forced-JSON output with
    // tool-calling is out of scope for this phase; `useTools` wins if both
    // are set (§4).
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
