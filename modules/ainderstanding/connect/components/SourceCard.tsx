'use client';

import { RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import type { DataSource, DataSourceStatus, DbDriver } from '@/core/types/workspace';

type Props = {
  source: DataSource;
  onTest: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

const DB_BADGE: Record<DbDriver, string> = {
  postgres: 'PG',
  duckdb: 'DDB',
  mssql: 'SQL',
  mysql: 'MY',
};

const STATUS_DOT: Record<DataSourceStatus, string> = {
  active: 'bg-green-400 animate-pulse',
  error: 'bg-red-400',
  pending: 'bg-muted-foreground',
};

function formatTestedAt(value: string | null): string {
  if (!value) return 'Not tested';
  const date = new Date(value);
  return `Tested ${date.toLocaleString()}`;
}

export function SourceCard({ source, onTest, onEdit, onRemove }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className="shrink-0 font-mono text-xs">
            {DB_BADGE[source.dbType]}
          </Badge>
          <h3 className="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-foreground">
            {source.name}
          </h3>
        </div>
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[source.status]}`}
          aria-label={source.status}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{formatTestedAt(source.lastTestedAt)}</p>

      <div className="mt-3 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onTest} className="h-7 px-2 text-xs">
          <RefreshCw className="h-3 w-3" />
          Test
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} className="h-7 px-2 text-xs">
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </Button>
      </div>
    </div>
  );
}
