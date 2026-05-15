'use client';

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  cn,
} from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';
import type { AIMode } from '@/core/types/agent';

const MODES: { value: AIMode; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'All agents' },
  { value: 'documentation', label: 'Documentation', description: 'Doc agents only' },
  { value: 'queries', label: 'Queries', description: 'SQL agents only' },
  { value: 'manual', label: 'Manual', description: 'No agents' },
];

const MODE_COLORS: Record<AIMode, string> = {
  auto: 'bg-accent-ai',
  documentation: 'bg-layer-1',
  queries: 'bg-primary',
  manual: 'bg-muted-foreground',
};

export function ModeSelector({ className }: { className?: string }) {
  const aiMode = useWorkspaceStore((s) => s.aiMode);
  const setAiMode = useWorkspaceStore((s) => s.setAiMode);
  const current = MODES.find((m) => m.value === aiMode) ?? MODES[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-body text-foreground hover:bg-accent transition-colors',
            className,
          )}
          aria-label="AI mode"
        >
          <span className={cn('h-2 w-2 rounded-full', MODE_COLORS[aiMode])} />
          <span>{current.label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <p className="px-2 py-1.5 text-caption text-muted-foreground uppercase tracking-widest">AI Mode</p>
        <DropdownMenuRadioGroup value={aiMode} onValueChange={(v) => setAiMode(v as AIMode)}>
          {MODES.map((mode) => (
            <DropdownMenuRadioItem key={mode.value} value={mode.value}>
              <div className="flex flex-col">
                <span className="text-body">{mode.label}</span>
                <span className="text-caption text-muted-foreground">{mode.description}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
