import { AlertTriangle, Bot, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentCommunicationTimeline } from '@/components/chat/agent-communication-timeline';
import { AgentPlanView } from '@/components/chat/agent-plan-view';
import { AgentReasoningTimeline } from '@/components/chat/agent-reasoning-timeline';
import { EvaluationDashboard } from '@/components/chat/evaluation-dashboard';
import { EvaluationScorecards } from '@/components/chat/evaluation-scorecards';
import { GraphExecutionReplay } from '@/components/chat/graph-execution-replay';
import { GraphStateInspector } from '@/components/chat/graph-state-inspector';
import { GraphVisualization } from '@/components/chat/graph-visualization';
import { GuardrailsPanel } from '@/components/chat/guardrails-panel';
import { HumanApprovalPanel } from '@/components/chat/human-approval-panel';
import { MemoryPanel } from '@/components/chat/memory-panel';
import { MultiAgentDashboard } from '@/components/chat/multi-agent-dashboard';
import { OutputComparisonView } from '@/components/chat/output-comparison-view';
import { PromptPreviewPanel } from '@/components/chat/prompt-preview-panel';
import { RetrievalTimeline } from '@/components/chat/retrieval-timeline';
import { citationAnchorId, SourcesPanel } from '@/components/chat/sources-panel';
import { StructuredOutputViewer } from '@/components/chat/structured-output-viewer';
import { ToolTimeline } from '@/components/chat/tool-timeline';
import { UsageBadges } from '@/components/chat/usage-badges';
import { VariableInspectorPanel } from '@/components/chat/variable-inspector-panel';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  /** Needed by `GraphStateInspector` to fetch `GET /api/v1/graph/state/:sessionId` — the LangGraph thread id is the chat session, not the message. */
  sessionId?: string;
  /** Wired to `useChat()`'s `approveGraphRun` — resumes this message's paused graph turn. */
  onApproveGraph?: (messageId: string, approved: boolean, feedback?: string) => void;
}

/** Turns bare `[1]`, `[2]` citation markers into markdown links anchored to the matching SourcesPanel entry, without touching real markdown links like `[text](url)`. */
function linkifyCitations(content: string, messageId: string): string {
  return content.replace(/\[(\d+)\](?!\()/g, (match, index: string) => {
    return `[${match}](#${citationAnchorId(messageId, Number(index))})`;
  });
}

export function MessageBubble({ message, sessionId, onApproveGraph }: MessageBubbleProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [graphActiveIndex, setGraphActiveIndex] = useState<number | undefined>(undefined);
  const isUser = message.role === 'user';
  const citations = message.citations ?? [];

  const markdownComponents = useMemo<Components>(
    () => ({
      a: ({ href, children, ...props }) => {
        if (href?.startsWith(`#cite-${message.id}-`)) {
          return (
            <a
              {...props}
              href={href}
              className="text-primary font-medium no-underline hover:underline"
              onClick={(event) => {
                event.preventDefault();
                setSourcesOpen(true);
                requestAnimationFrame(() => {
                  document.getElementById(href.slice(1))?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                });
              }}
            >
              {children}
            </a>
          );
        }
        return (
          <a {...props} href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
    }),
    [message.id],
  );

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <Avatar className="mt-0.5 size-8 shrink-0">
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex min-w-0 max-w-[80%] flex-col gap-2', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-card border',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {linkifyCitations(message.content, message.id)}
              </ReactMarkdown>
            </div>
          ) : message.isStreaming ? (
            <span className="text-muted-foreground">Thinking…</span>
          ) : null}
          {message.isStreaming && (
            <span className="streaming-cursor bg-foreground ml-0.5 inline-block h-4 w-1.5 translate-y-0.5" />
          )}
        </div>

        {message.error && (
          <p className="text-destructive flex items-center gap-1.5 text-xs">
            <AlertTriangle className="size-3.5" />
            {message.error}
          </p>
        )}

        {!isUser &&
          (citations.length > 0 ||
            message.usage ||
            message.memory ||
            message.promptInfo ||
            (message.toolCalls && message.toolCalls.length > 0) ||
            (message.agentSteps && message.agentSteps.length > 0) ||
            (message.graphNodes && message.graphNodes.length > 0) ||
            (message.agentTurns && message.agentTurns.length > 0) ||
            message.evaluation ||
            message.pendingApproval ||
            message.latencyMs !== undefined) && (
            <div className="flex w-full flex-col gap-2 px-1">
              <SourcesPanel
                citations={citations}
                messageId={message.id}
                open={sourcesOpen}
                onOpenChange={setSourcesOpen}
              />
              <PromptPreviewPanel citations={citations} />
              <RetrievalTimeline retrieval={message.retrieval} />
              <MemoryPanel memory={message.memory} />
              <VariableInspectorPanel promptInfo={message.promptInfo} />
              <StructuredOutputViewer structuredOutput={message.structuredOutput} />
              <ToolTimeline toolCalls={message.toolCalls} />
              <AgentPlanView plan={message.agentPlan} />
              <AgentReasoningTimeline steps={message.agentSteps} />
              <GraphVisualization nodes={message.graphNodes} activeIndex={graphActiveIndex} />
              <GraphExecutionReplay
                nodes={message.graphNodes}
                activeIndex={graphActiveIndex}
                onActiveIndexChange={setGraphActiveIndex}
              />
              {sessionId && message.graphNodes && message.graphNodes.length > 0 && (
                <GraphStateInspector
                  sessionId={sessionId}
                  nodes={message.graphNodes}
                  pendingApproval={message.pendingApproval}
                />
              )}
              <HumanApprovalPanel
                pendingApproval={message.pendingApproval}
                disabled={message.isStreaming}
                onDecision={(approved, feedback) =>
                  onApproveGraph?.(message.id, approved, feedback)
                }
              />
              <MultiAgentDashboard turns={message.agentTurns} />
              <AgentCommunicationTimeline
                communicationLog={message.multiAgentRun?.communicationLog}
              />
              <OutputComparisonView
                draftHistory={message.multiAgentRun?.draftHistory}
                reviewHistory={message.multiAgentRun?.reviewHistory}
              />
              <EvaluationDashboard evaluation={message.evaluation} />
              <EvaluationScorecards evaluation={message.evaluation} />
              <GuardrailsPanel guardrails={message.guardrails} />
              <UsageBadges
                usage={message.usage}
                model={message.model}
                latencyMs={message.latencyMs}
                firstTokenMs={message.firstTokenMs}
              />
            </div>
          )}
      </div>
    </div>
  );
}
