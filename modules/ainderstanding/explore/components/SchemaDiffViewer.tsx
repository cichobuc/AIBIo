'use client';

import { Badge } from '@/core/ui/badge';

type Change = {
  changeType: string;
  tableName: string;
  columnName?: string | null;
  detectedAt: string;
};

type Props = {
  changes: Change[];
};

const CHANGE_COLORS: Record<string, string> = {
  table_added: 'text-green-600',
  column_added: 'text-green-500',
  table_removed: 'text-destructive',
  column_removed: 'text-destructive',
  column_type_changed: 'text-yellow-600',
  column_nullability_changed: 'text-yellow-500',
};

const CHANGE_LABELS: Record<string, string> = {
  table_added: '+ table',
  column_added: '+ col',
  table_removed: '− table',
  column_removed: '− col',
  column_type_changed: '~ type',
  column_nullability_changed: '~ null',
};

export function SchemaDiffViewer({ changes }: Props) {
  if (changes.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">No schema changes detected</div>
    );
  }

  return (
    <div className="p-3 space-y-1">
      <p className="text-xs font-medium text-foreground mb-2">
        {changes.length} change{changes.length !== 1 ? 's' : ''} detected
      </p>
      {changes.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className={`font-mono w-14 shrink-0 ${CHANGE_COLORS[c.changeType] ?? 'text-foreground'}`}>
            {CHANGE_LABELS[c.changeType] ?? c.changeType}
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {c.tableName}
            {c.columnName ? <span className="text-muted-foreground">.{c.columnName}</span> : null}
          </span>
          <span className="text-muted-foreground text-[10px] ml-auto shrink-0">
            {new Date(c.detectedAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
