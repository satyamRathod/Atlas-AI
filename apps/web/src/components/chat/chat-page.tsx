import { Columns2, RotateCcw, Settings2, SlidersHorizontal, Sparkles, Wrench } from 'lucide-react';
import { useState } from 'react';

import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { PromptComparisonDialog } from '@/components/chat/prompt-comparison-dialog';
import { PromptSettingsBar } from '@/components/chat/prompt-settings-bar';
import { RetrievalSettingsBar } from '@/components/chat/retrieval-settings-bar';
import { ToolSettingsBar } from '@/components/chat/tool-settings-bar';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/use-chat';
import { usePromptSettings } from '@/hooks/use-prompt-settings';
import { useRetrievalSettings } from '@/hooks/use-retrieval-settings';
import { useToolSettings } from '@/hooks/use-tool-settings';
import { cn } from '@/lib/utils';

type SettingsPanel = 'none' | 'retrieval' | 'prompt' | 'tools';

export function ChatPage() {
  const { messages, isStreaming, sendMessage, resetConversation } = useChat();
  const { settings, updateSettings, resetSettings } = useRetrievalSettings();
  const promptSettings = usePromptSettings();
  const toolSettings = useToolSettings();
  const [openPanel, setOpenPanel] = useState<SettingsPanel>('none');
  const [compareOpen, setCompareOpen] = useState(false);

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
            variant="ghost"
            size="sm"
            onClick={() => setCompareOpen(true)}
            className="gap-1.5"
          >
            <Columns2 className="size-3.5" />
            Compare
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

      <MessageList messages={messages} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <ChatInput
          onSend={(content) =>
            sendMessage(content, settings, promptSettings.settings, toolSettings.settings)
          }
          disabled={isStreaming}
        />
      </div>

      <PromptComparisonDialog open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );
}
