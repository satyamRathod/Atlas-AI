import { SendHorizontal } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
        disabled={disabled}
        rows={1}
        className="max-h-40 resize-none"
      />
      <Button
        onClick={submit}
        disabled={disabled || !value.trim()}
        size="icon"
        aria-label="Send message"
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}
