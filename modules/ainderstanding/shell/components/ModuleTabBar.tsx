'use client';

import { useRouter } from 'next/navigation';
import { X, Database, Shield, Layers, FileText, CheckSquare, Download, Plug } from 'lucide-react';
import { cn } from '@/core/ui';
import type { LucideIcon } from 'lucide-react';

const MODULE_META: Record<string, { label: string; icon: LucideIcon }> = {
  connect: { label: 'Connect', icon: Plug },
  explore: { label: 'Explore', icon: Database },
  govern: { label: 'Govern', icon: Shield },
  model: { label: 'Model', icon: Layers },
  document: { label: 'Document', icon: FileText },
  test: { label: 'Test', icon: CheckSquare },
  export: { label: 'Export', icon: Download },
};

interface Props {
  openModules: string[];
  activeModule: string;
  workspaceId: string;
  onClose: (mod: string) => void;
}

export function ModuleTabBar({ openModules, activeModule, workspaceId, onClose }: Props) {
  const router = useRouter();

  if (openModules.length <= 1) return null;

  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-border bg-background overflow-x-auto">
      {openModules.map((mod) => {
        const meta = MODULE_META[mod];
        const Icon = meta?.icon;
        const isActive = mod === activeModule;

        return (
          <div
            key={mod}
            className={cn(
              'group flex items-center gap-1.5 border-r border-border px-3 text-xs cursor-pointer select-none shrink-0',
              isActive
                ? 'bg-card text-foreground border-t-2 border-t-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
            onClick={() => router.push(`/workspace/${workspaceId}/${mod}`)}
          >
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            <span>{meta?.label ?? mod}</span>
            <button
              className={cn(
                'ml-0.5 rounded p-0.5 transition-colors',
                isActive
                  ? 'opacity-60 hover:opacity-100 hover:bg-muted'
                  : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted',
              )}
              onClick={(e) => {
                e.stopPropagation();
                onClose(mod);
              }}
              aria-label={`Close ${meta?.label ?? mod}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
