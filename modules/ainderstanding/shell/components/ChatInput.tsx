'use client';

import { useRef, useState, useCallback } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Textarea, Button, cn } from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';

export function ChatInput({ workspaceId }: { workspaceId: string }) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const aiMode = useWorkspaceStore((s) => s.aiMode);
  const pendingApproval = useWorkspaceStore((s) => s.pendingApproval);
  const setSession = useWorkspaceStore((s) => s.setSession);

  const isDisabled = aiMode === 'manual' || pendingApproval !== null || sending;
  const placeholder =
    aiMode === 'manual'
      ? 'Manual mode — AI agents disabled. Edit files directly.'
      : pendingApproval
        ? 'Waiting for approval...'
        : 'Ask about your data...';

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;

    setSending(true);
    try {
      const res = await fetch(`/api/chat/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      if (res.ok) {
        const data = await res.json() as { sessionId: string };
        setSession(true, data.sessionId);
        setValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="border-t border-border bg-card p-2">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className={cn(
            'min-h-[36px] max-h-[180px] resize-none bg-secondary text-body leading-5 transition-colors',
            isDisabled && 'cursor-not-allowed opacity-50',
          )}
        />
        <Button
          size="icon"
          onClick={() => void submit()}
          disabled={isDisabled || !value.trim()}
          className="h-9 w-9 shrink-0 bg-accent-ai hover:bg-accent-ai/90 text-white"
          aria-label="Send message (⌘↵)"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1 text-right text-caption text-muted-foreground/50">⌘↵ to send</p>
    </div>
  );
}
