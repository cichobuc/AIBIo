import { cn } from './utils';

type ModelBuildState = 'built' | 'stale' | 'not-built' | 'running' | 'failed';

const STATE_STYLES: Record<ModelBuildState, string> = {
  built: 'text-state-built',
  stale: 'text-state-stale',
  'not-built': 'text-state-not-built',
  running: 'text-state-running animate-pulse',
  failed: 'text-state-failed',
};

const STATE_ICONS: Record<ModelBuildState, string> = {
  built: '✓',
  stale: '⚠',
  'not-built': '○',
  running: '●',
  failed: '✗',
};

const STATE_LABELS: Record<ModelBuildState, string> = {
  built: 'built',
  stale: 'stale',
  'not-built': 'not built',
  running: 'running',
  failed: 'failed',
};

export function ModelStateBadge({
  state,
  showLabel = true,
  className,
}: {
  state: ModelBuildState;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-caption font-medium', STATE_STYLES[state], className)}>
      <span>{STATE_ICONS[state]}</span>
      {showLabel && <span>{STATE_LABELS[state]}</span>}
    </span>
  );
}
