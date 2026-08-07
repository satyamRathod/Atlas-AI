import { RotateCcw, Sparkles } from 'lucide-react';

import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/use-chat';

export function ChatPage() {
  const { messages, isStreaming, sendMessage, resetConversation } = useChat();

  return (
    <div className="bg-background flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-5" />
          <h1 className="font-semibold">Atlas AI</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={resetConversation} className="gap-1.5">
          <RotateCcw className="size-3.5" />
          New chat
        </Button>
      </header>

      <MessageList messages={messages} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
