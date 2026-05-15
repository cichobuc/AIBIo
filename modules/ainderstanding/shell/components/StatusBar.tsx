'use client';

import { cn } from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';

const MODE_COLORS: Record<string, string> = {
  auto: 'text-accent-ai',
  documentation: 'text-layer-1',
  queries: 'text-primary',
  manual: 'text-muted-foreground',
};

export function StatusBar({ workspaceId }: { workspaceId: string }) {
  const aiMode = useWorkspaceStore((s) => s.aiMode);
  const isSessionActive = useWorkspaceStore((s) => s.isSessionActive);
  const activeAgents = useWorkspaceStore((s) => s.activeAgents);
  const toggleBottom = useWorkspaceStore((s) => s.toggleBottomPanel);

  const modeLabel = aiMode.charAt(0).toUpperCase() + aiMode.slice(1);
  const primaryAgent = activeAgents[0];

  return (
    <footer className="flex h-[24px] shrink-0 items-center gap-3 border-t border-border bg-card px-3 text-caption text-muted-foreground">
      <span className={cn('flex items-center gap-1', MODE_COLORS[aiMode])}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {modeLabel}
      </span>

      <span className="h-3 w-px bg-border" />

      {primaryAgent ? (
        <button
          onClick={toggleBottom}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <span className="animate-pulse">⟳</span>
          <span>{primaryAgent.agentName}</span>
        </button>
      ) : (
        <span>{isSessionActive ? 'Running...' : 'Idle'}</span>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono">{workspaceId}</span>
        <span className="h-3 w-px bg-border" />
        <span className="text-accent hover:text-foreground cursor-pointer">⌘K</span>
      </div>
    </footer>
  );
}
