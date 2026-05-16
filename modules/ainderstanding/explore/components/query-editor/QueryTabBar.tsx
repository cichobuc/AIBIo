'use client';

import { X, Code2 } from 'lucide-react';
import { cn } from '@/core/ui';

type Tab = {
  id: string;
  title: string | null;
  index: number;
};

type Props = {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
};

export function QueryTabBar({ tabs, activeId, onSelect, onClose }: Props) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-8 shrink-0 items-center gap-0 border-b border-border bg-muted/20 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={cn(
            'flex h-full min-w-0 max-w-[180px] shrink-0 items-center gap-1.5 border-r border-border px-3 text-xs transition-colors group',
            tab.id === activeId
              ? 'bg-background text-foreground border-b-2 border-b-primary -mb-px'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
          )}
        >
          <Code2 className="h-3 w-3 shrink-0" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {tab.title ?? `Query ${tab.index + 1}`}
          </span>
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
            className={cn(
              'ml-0.5 rounded-sm p-0.5 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-muted',
              tab.id === activeId && 'opacity-60',
            )}
            aria-label="Close tab"
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      ))}
    </div>
  );
}
