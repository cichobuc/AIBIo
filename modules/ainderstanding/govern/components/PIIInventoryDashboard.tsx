'use client';

import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Badge } from '@/core/ui/badge';
import { PiiLayerChip } from './PiiLayerChip';

const PII_SUBTYPE_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  national_id: 'National ID',
  address: 'Address',
  ip: 'IP address',
  name: 'Name',
  date_of_birth: 'Date of birth',
  iban: 'IBAN',
  other: 'Other',
};

export type PiiInventoryRow = {
  dataSourceId: string;
  tableName: string;
  columnName: string;
  piiClassification: string | null;
  piiSubtype: string | null;
  setBy: 'user' | 'heuristic' | null;
};

type SourceRow = { id: string; name: string };

type HighlightTarget = {
  dataSourceId: string;
  tableName: string;
  columnName: string;
};

type Props = {
  workspaceId: string;
  sources: SourceRow[];
  piiColumns: PiiInventoryRow[];
  onEdit: (row: PiiInventoryRow) => void;
  onRefresh: () => void;
  highlight?: HighlightTarget;
};

function downloadCsv(rows: PiiInventoryRow[], sources: SourceRow[]) {
  const srcMap = new Map(sources.map((s) => [s.id, s.name]));
  const header = 'source,table,column,classification,subtype,set_by\n';
  const body = rows
    .map(
      (r) =>
        [
          srcMap.get(r.dataSourceId) ?? r.dataSourceId,
          r.tableName,
          r.columnName,
          r.piiClassification ?? '',
          r.piiSubtype ?? '',
          r.setBy ?? '',
        ].join(','),
    )
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pii-inventory.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function PIIInventoryDashboard({ workspaceId, sources, piiColumns, onEdit, onRefresh, highlight }: Props) {
  const [filterSource, setFilterSource] = useState<string>(highlight?.dataSourceId ?? 'all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = piiColumns.filter((row) => {
    if (filterSource !== 'all' && row.dataSourceId !== filterSource) return false;
    if (filterType !== 'all' && row.piiSubtype !== filterType) return false;
    if (filterStatus === 'confirmed' && row.setBy !== 'user') return false;
    if (filterStatus === 'review' && row.setBy !== 'heuristic') return false;
    return true;
  });

  const needsReview = piiColumns.filter((r) => r.setBy === 'heuristic').length;

  if (piiColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <p className="text-xs text-muted-foreground">No PII-classified columns yet.</p>
        <p className="text-[11px] text-muted-foreground">Run schema discovery and profiling to detect candidates.</p>
        <a
          href={`/workspace/${workspaceId}/explore`}
          className="text-xs text-primary underline underline-offset-2"
        >
          Go to Explore →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All types</SelectItem>
              {Object.entries(PII_SUBTYPE_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              <SelectItem value="confirmed" className="text-xs">Confirmed</SelectItem>
              <SelectItem value="review" className="text-xs">Needs review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onRefresh}
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => downloadCsv(filtered, sources)}
          title="Export CSV"
        >
          <Download className="h-3 w-3 mr-1" />
          CSV
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground text-[10px]">
              <th className="text-left py-1.5 pr-3 font-medium w-28">Source</th>
              <th className="text-left py-1.5 pr-3 font-medium">Table · Column</th>
              <th className="text-left py-1.5 pr-3 font-medium w-24">PII Type</th>
              <th className="text-left py-1.5 pr-3 font-medium w-20">Status</th>
              <th className="text-left py-1.5 pr-3 font-medium w-10">Layer</th>
              <th className="w-14" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const src = sources.find((s) => s.id === row.dataSourceId);
              const isReview = row.setBy === 'heuristic';
              const isHighlighted = highlight &&
                row.dataSourceId === highlight.dataSourceId &&
                row.tableName === highlight.tableName &&
                row.columnName === highlight.columnName;
              return (
                <tr key={i} className={`border-b hover:bg-muted/30 transition-colors${isHighlighted ? ' ring-1 ring-primary ring-inset' : ''}`}>
                  <td className="py-1.5 pr-3 text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap max-w-[112px]">
                    {src?.name ?? row.dataSourceId.slice(0, 8)}
                  </td>
                  <td className="py-1.5 pr-3 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                    {row.tableName}.<span className="text-destructive">{row.columnName}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    {row.piiSubtype ? PII_SUBTYPE_LABELS[row.piiSubtype] ?? row.piiSubtype : '—'}
                  </td>
                  <td className="py-1.5 pr-3">
                    {isReview ? (
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">Review</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-700">Confirmed</Badge>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <PiiLayerChip classification={row.piiClassification} />
                  </td>
                  <td className="py-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-2"
                      onClick={() => onEdit(row)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No columns match current filters.</p>
        )}
      </div>

      {/* Footer */}
      <div className="text-[10px] text-muted-foreground pt-1 border-t flex items-center gap-2">
        <span>{piiColumns.length} PII column{piiColumns.length !== 1 ? 's' : ''}</span>
        {needsReview > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-600">{needsReview} need{needsReview !== 1 ? 's' : ''} review</span>
          </>
        )}
      </div>
    </div>
  );
}
