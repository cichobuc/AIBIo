import { cn } from './utils';

type GdprLayer = 'L1' | 'L2' | 'L3' | '?';

const LAYER_STYLES: Record<GdprLayer, string> = {
  L1: 'text-layer-1 border-layer-1/50 bg-layer-1/10',
  L2: 'text-layer-2 border-layer-2/50 bg-layer-2/10',
  L3: 'text-layer-3 border-layer-3/50 bg-layer-3/10',
  '?': 'text-layer-unknown border-layer-unknown/50 bg-layer-unknown/10',
};

const LAYER_LABELS: Record<GdprLayer, string> = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  '?': '?',
};

export function GdprBadge({ layer, className }: { layer: GdprLayer; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1 font-mono text-caption font-medium leading-none',
        LAYER_STYLES[layer],
        className,
      )}
      title={`GDPR Layer ${layer}`}
    >
      {LAYER_LABELS[layer]}
    </span>
  );
}
