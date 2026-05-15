'use client';

import { X } from 'lucide-react';
import { cn } from '@/core/ui';

type ContextItem = {
  id: string;
  label: string;
  icon: string;
};

export function ContextBar({
  items,
  onRemove,
  className,
}: {
  items: ContextItem[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn('border-t border-border bg-secondary/30 px-3 py-1.5', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-caption text-muted-foreground shrink-0">Context:</span>
        {items.map((item) => (
          <span
            key={item.id}
            className="flex items-center gap-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-caption text-foreground"
          >
            <span>{item.icon}</span>
            <span className="max-w-[120px] truncate">{item.label}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="ml-0.5 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${item.label} from context`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
