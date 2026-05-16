'use client';

type PiiClassification = 'none' | 'pii' | 'sensitive';

const LAYER_MAP: Record<PiiClassification, { label: string; cls: string }> = {
  none: { label: 'L1', cls: 'text-layer-1 border-layer-1/40 bg-layer-1/10' },
  sensitive: { label: 'L2', cls: 'text-layer-2 border-layer-2/40 bg-layer-2/10' },
  pii: { label: 'L3', cls: 'text-layer-3 border-layer-3/40 bg-layer-3/10' },
};

export function PiiLayerChip({ classification }: { classification: PiiClassification | string | null }) {
  const info = LAYER_MAP[(classification ?? 'none') as PiiClassification] ?? { label: '?', cls: 'text-muted-foreground border-border bg-muted' };
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${info.cls}`}>
      {info.label}
    </span>
  );
}
