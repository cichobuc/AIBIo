'use client';

import { Square } from 'lucide-react';
import { Button, cn } from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';

export function ActiveAgentsBadge() {
  const activeAgents = useWorkspaceStore((s) => s.activeAgents);

  if (activeAgents.length === 0) return null;

  return (
    <div className="border-b border-border bg-secondary/50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-caption text-muted-foreground uppercase tracking-widest">Active Agents</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
          <Square className="h-3 w-3" />
        </Button>
      </div>
      {activeAgents.map((agent) => (
        <div key={agent.agentName} className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <span className="animate-spin text-accent-ai">⟳</span>
          <span className="text-accent-ai font-mono">{agent.agentName}</span>
          <span className="truncate text-muted-foreground/70">{agent.message}</span>
        </div>
      ))}
    </div>
  );
}
