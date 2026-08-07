import { Bot } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { MessageBubble } from '@/components/chat/message-bubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessage } from '@/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run whenever messages change to auto-scroll to the latest one
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Bot className="size-10" />
        <div>
          <p className="font-medium">Ask Atlas anything about your knowledge base</p>
          <p className="text-sm">Answers are grounded in retrieved context with citations.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
