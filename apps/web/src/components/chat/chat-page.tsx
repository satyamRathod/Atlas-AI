import { RotateCcw, Settings2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { RetrievalSettingsBar } from '@/components/chat/retrieval-settings-bar';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/use-chat';
import { useRetrievalSettings } from '@/hooks/use-retrieval-settings';
import { cn } from '@/lib/utils';

export function ChatPage() {
  const { messages, isStreaming, sendMessage, resetConversation } = useChat();
  const { settings, updateSettings, resetSettings } = useRetrievalSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="bg-background flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-5" />
          <h1 className="font-semibold">Atlas AI</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={settingsOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="gap-1.5"
          >
            <Settings2 className={cn('size-3.5', settingsOpen && 'text-primary')} />
            Retrieval
          </Button>
          <Button variant="ghost" size="sm" onClick={resetConversation} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            New chat
          </Button>
        </div>
      </header>

      {settingsOpen && (
        <RetrievalSettingsBar
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
        />
      )}

      <MessageList messages={messages} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <ChatInput onSend={(content) => sendMessage(content, settings)} disabled={isStreaming} />
      </div>
    </div>
  );
}
