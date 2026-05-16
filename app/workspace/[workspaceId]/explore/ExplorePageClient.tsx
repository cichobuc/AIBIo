'use client';

import { useSearchParams } from 'next/navigation';
import { ColumnProfileDetailTab } from '@/modules/ainderstanding/explore/components/ColumnProfileDetailTab';
import { SchemaDiffViewer } from '@/modules/ainderstanding/explore/components/SchemaDiffViewer';
import { PIICandidatesPanel } from '@/modules/ainderstanding/explore/components/PIICandidatesPanel';
import { TableDetailTab } from '@/modules/ainderstanding/explore/components/TableDetailTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs';
import { Badge } from '@/core/ui/badge';
type TableProfile = {
  id: string;
  dataSourceId: string;
  tableName: string;
  rowCount: number | null;
  isReferenceTable: boolean;
  samplePermissionOverride: string | null;
  profiledAt: string | null;
};

type ColumnProfile = {
  id: string;
  dataSourceId: string;
  tableName: string;
  columnName: string;
  dataType: string;
  nullCount: number | null;
  nullRate: number | null;
  distinctCount: number | null;
  topValuesJson: string | null;
  minValue: string | null;
  maxValue: string | null;
  meanValue: number | null;
  piiCandidate: boolean;
  piiCandidateReason: string | null;
};

type SchemaChange = {
  id: string;
  dataSourceId: string;
  changeType: string;
  tableName: string;
  columnName?: string | null;
  detectedAt: string;
};

type Props = {
  workspaceId: string;
  tables: TableProfile[];
  columns: ColumnProfile[];
  recentChanges: SchemaChange[];
};

type SelectedTable = { sourceId: string; tableName: string };

export function ExplorePageClient({ workspaceId, tables, columns, recentChanges }: Props) {
  const sp = useSearchParams();
  const selectedTable: SelectedTable | undefined =
    sp.get('source') && sp.get('table')
      ? { sourceId: sp.get('source')!, tableName: sp.get('table')! }
      : undefined;

  const tableProfileMap = new Map(
    tables.map((t) => [`${t.dataSourceId}:${t.tableName}`, t]),
  );

  const selectedProfile = selectedTable
    ? tableProfileMap.get(`${selectedTable.sourceId}:${selectedTable.tableName}`)
    : undefined;

  const selectedColumns = selectedTable
    ? columns.filter(
        (c) =>
          c.dataSourceId === selectedTable.sourceId &&
          c.tableName === selectedTable.tableName,
      )
    : [];

  const piiCandidates = columns
    .filter((c) => c.piiCandidate)
    .map((c) => ({
      dataSourceId: c.dataSourceId,
      tableName: c.tableName,
      columnName: c.columnName,
      piiCandidateReason: c.piiCandidateReason,
    }));

  const handleConfirmPii = async (candidate: (typeof piiCandidates)[0]) => {
    await fetch(`/api/govern/column-permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataSourceId: candidate.dataSourceId,
        workspaceId,
        tableName: candidate.tableName,
        columnName: candidate.columnName,
        piiClassification: 'pii',
        setBy: 'user',
      }),
    });
  };

  const handleDismiss = (_candidate: (typeof piiCandidates)[0]) => {};

  return (
    <div className="flex h-full flex-col min-w-0">
      {!selectedTable ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Select a table to inspect
          </div>
        ) : (
          <Tabs defaultValue="data" className="flex flex-col h-full">
            <div className="border-b px-4 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{selectedTable.tableName}</span>
                {selectedProfile?.isReferenceTable && (
                  <Badge variant="outline" className="text-xs">reference</Badge>
                )}
                {selectedProfile?.rowCount != null && (
                  <span className="text-xs text-muted-foreground">
                    {selectedProfile.rowCount.toLocaleString()} rows
                  </span>
                )}
              </div>
              <TabsList className="h-7">
                <TabsTrigger value="data" className="text-xs">
                  Data
                </TabsTrigger>
                <TabsTrigger value="columns" className="text-xs">
                  Columns {selectedColumns.length > 0 && `(${selectedColumns.length})`}
                </TabsTrigger>
                <TabsTrigger value="diff" className="text-xs">
                  Changes
                </TabsTrigger>
                <TabsTrigger value="pii" className="text-xs">
                  PII{piiCandidates.length > 0 && (
                    <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                      {piiCandidates.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="data" className="flex-1 overflow-auto m-0">
              <TableDetailTab
                workspaceId={workspaceId}
                sourceId={selectedTable.sourceId}
                tableName={selectedTable.tableName}
              />
            </TabsContent>

            <TabsContent value="columns" className="flex-1 overflow-auto m-0">
              {selectedColumns.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  {selectedProfile ? 'Not profiled yet — Run data profiling' : 'Profiling in progress…'}
                </div>
              ) : (
                <div className="divide-y">
                  {selectedColumns.map((col) => (
                    <ColumnProfileDetailTab key={col.columnName} profile={col} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="diff" className="flex-1 overflow-auto m-0">
              <SchemaDiffViewer
                changes={recentChanges.filter(
                  (c) =>
                    c.dataSourceId === selectedTable.sourceId &&
                    c.tableName === selectedTable.tableName,
                )}
              />
            </TabsContent>

            <TabsContent value="pii" className="flex-1 overflow-auto m-0">
              <PIICandidatesPanel
                candidates={piiCandidates.filter(
                  (c) =>
                    c.dataSourceId === selectedTable.sourceId &&
                    c.tableName === selectedTable.tableName,
                )}
                onConfirm={handleConfirmPii}
                onDismiss={handleDismiss}
              />
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
}
