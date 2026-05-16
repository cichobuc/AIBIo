'use client';

import { useState } from 'react';
import { PanelRightClose } from 'lucide-react';
import { Button, cn } from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';
import { ActiveAgentsBadge } from './ActiveAgentsBadge';
import { MessageList } from './MessageList';
import { ContextBar } from './ContextBar';
import { ChatInput } from './ChatInput';

async function resolveApproval(requestId: string, decision: 'approved' | 'denied') {
  await fetch(`/api/approvals/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}

export function GlobalChatPanel({ workspaceId }: { workspaceId: string }) {
  const [contextItems, setContextItems] = useState<{ id: string; label: string; icon: string }[]>([]);
  const toggleChat = useWorkspaceStore((s) => s.toggleChatPanel);

  function removeContextItem(id: string) {
    setContextItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="flex h-full flex-col bg-card border-l border-border overflow-hidden">
      {/* Header */}
      <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-accent-ai">✨</span>
          <span className="text-body font-medium text-foreground">AI Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={toggleChat}
          aria-label="Collapse AI panel (⌘\)"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Active agents */}
      <ActiveAgentsBadge />

      {/* Messages */}
      <MessageList
        workspaceId={workspaceId}
        onApproval={resolveApproval}
      />

      {/* Context bar */}
      <ContextBar items={contextItems} onRemove={removeContextItem} />

      {/* Input */}
      <ChatInput workspaceId={workspaceId} />
    </div>
  );
}
