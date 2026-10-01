import {
  Activity,
  ClipboardCheck,
  Columns2,
  FlaskConical,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';

import { BenchmarkDialog } from '@/components/chat/benchmark-dialog';
import { ChatInput } from '@/components/chat/chat-input';
import { EvaluationSettingsBar } from '@/components/chat/evaluation-settings-bar';
import { MessageList } from '@/components/chat/message-list';
import { ObservabilityDialog } from '@/components/chat/observability-dialog';
import { PromptComparisonDialog } from '@/components/chat/prompt-comparison-dialog';
import { PromptSettingsBar } from '@/components/chat/prompt-settings-bar';
import { RetrievalSettingsBar } from '@/components/chat/retrieval-settings-bar';
import { ToolSettingsBar } from '@/components/chat/tool-settings-bar';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/use-chat';
import { useEvaluationSettings } from '@/hooks/use-evaluation-settings';
import { usePromptSettings } from '@/hooks/use-prompt-settings';
import { useRetrievalSettings } from '@/hooks/use-retrieval-settings';
import { useToolSettings } from '@/hooks/use-tool-settings';
import { cn } from '@/lib/utils';

type SettingsPanel = 'none' | 'retrieval' | 'prompt' | 'tools' | 'evaluation';

export function ChatPage() {
  const { messages, sessionId, isStreaming, sendMessage, approveGraphRun, resetConversation } =
    useChat();
  const { settings, updateSettings, resetSettings } = useRetrievalSettings();
  const promptSettings = usePromptSettings();
  const toolSettings = useToolSettings();
  const evaluationSettings = useEvaluationSettings();
  const [openPanel, setOpenPanel] = useState<SettingsPanel>('none');
  const [compareOpen, setCompareOpen] = useState(false);
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const [observabilityOpen, setObservabilityOpen] = useState(false);

  const togglePanel = (panel: SettingsPanel) => {
    setOpenPanel((prev) => (prev === panel ? 'none' : panel));
  };

  return (
    <div className="bg-background flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-5" />
          <h1 className="font-semibold">Atlas AI</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={openPanel === 'retrieval' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => togglePanel('retrieval')}
            className="gap-1.5"
          >
            <Settings2 className={cn('size-3.5', openPanel === 'retrieval' && 'text-primary')} />
            Retrieval
          </Button>
          <Button
            variant={openPanel === 'prompt' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => togglePanel('prompt')}
            className="gap-1.5"
          >
            <SlidersHorizontal
              className={cn('size-3.5', openPanel === 'prompt' && 'text-primary')}
            />
            Prompt
          </Button>
          <Button
            variant={openPanel === 'tools' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => togglePanel('tools')}
            className="gap-1.5"
          >
            <Wrench className={cn('size-3.5', openPanel === 'tools' && 'text-primary')} />
            Tools
          </Button>
          <Button
            variant={openPanel === 'evaluation' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => togglePanel('evaluation')}
            className="gap-1.5"
          >
            <ClipboardCheck
              className={cn('size-3.5', openPanel === 'evaluation' && 'text-primary')}
            />
            Eval
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCompareOpen(true)}
            className="gap-1.5"
          >
            <Columns2 className="size-3.5" />
            Compare
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBenchmarkOpen(true)}
            className="gap-1.5"
          >
            <FlaskConical className="size-3.5" />
            Benchmarks
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setObservabilityOpen(true)}
            className="gap-1.5"
          >
            <Activity className="size-3.5" />
            Observability
          </Button>
          <Button variant="ghost" size="sm" onClick={resetConversation} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            New chat
          </Button>
        </div>
      </header>

      {openPanel === 'retrieval' && (
        <RetrievalSettingsBar
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
        />
      )}

      {openPanel === 'prompt' && (
        <PromptSettingsBar
          settings={promptSettings.settings}
          onUpdate={promptSettings.updateSettings}
          onReset={promptSettings.resetSettings}
        />
      )}

      {openPanel === 'tools' && (
        <ToolSettingsBar
          settings={toolSettings.settings}
          onUpdate={toolSettings.updateSettings}
          onReset={toolSettings.resetSettings}
        />
      )}

      {openPanel === 'evaluation' && (
        <EvaluationSettingsBar
          settings={evaluationSettings.settings}
          onUpdate={evaluationSettings.updateSettings}
          onReset={evaluationSettings.resetSettings}
        />
      )}

      <MessageList messages={messages} sessionId={sessionId} onApproveGraph={approveGraphRun} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <ChatInput
          onSend={(content) =>
            sendMessage(
              content,
              settings,
              promptSettings.settings,
              toolSettings.settings,
              evaluationSettings.settings,
            )
          }
          disabled={isStreaming}
        />
      </div>

      <PromptComparisonDialog open={compareOpen} onOpenChange={setCompareOpen} />
      <BenchmarkDialog open={benchmarkOpen} onOpenChange={setBenchmarkOpen} />
      <ObservabilityDialog open={observabilityOpen} onOpenChange={setObservabilityOpen} />
    </div>
  );
}
