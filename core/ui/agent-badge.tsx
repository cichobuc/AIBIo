import { cn } from './utils';
import type { ActorName } from '@/core/types/agent';

const MODEL_LABELS: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
};

export function AgentBadge({
  name,
  model,
  className,
}: {
  name: ActorName | string;
  model?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex items-center gap-1 rounded border border-accent-ai/40 bg-accent-ai/10 px-1.5 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-ai" />
        <span className="font-mono text-caption text-accent-ai">{name}</span>
      </span>
      {model && MODEL_LABELS[model] && (
        <span className="text-caption text-muted-foreground">{MODEL_LABELS[model]}</span>
      )}
    </span>
  );
}
