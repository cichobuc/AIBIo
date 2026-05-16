'use client';

import { useState, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ColumnProfileDetailTab } from '@/modules/ainderstanding/explore/components/ColumnProfileDetailTab';
import { SchemaDiffViewer } from '@/modules/ainderstanding/explore/components/SchemaDiffViewer';
import { TableDetailTab } from '@/modules/ainderstanding/explore/components/TableDetailTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import type { AccessTier } from '@/modules/ainderstanding/explore/components/schema-tree/types';
import type {
  ExploreSourcePerm,
  ExploreTablePerm,
  ExploreColumnPerm,
} from '@/modules/ainderstanding/explore/lib/explore-data';

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
  percentilesJson: string | null;
  stringLengthDistributionJson: string | null;
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
  sourcePerms: ExploreSourcePerm[];
  tablePerms: ExploreTablePerm[];
  columnPerms: ExploreColumnPerm[];
};

type SelectedTable = { sourceId: string; tableName: string };

const TIER_RANK: Record<AccessTier, number> = {
  metadata_only: 0,
  with_reference_samples: 1,
  with_full_samples: 2,
  with_query_results: 3,
};

function computeEffectiveTier(
  sourceId: string,
  tableName: string,
  columnName: string | null,
  sourcePerms: ExploreSourcePerm[],
  tablePerms: ExploreTablePerm[],
  columnPerms: ExploreColumnPerm[],
): AccessTier {
  const sourceTier = sourcePerms.find((p) => p.dataSourceId === sourceId)?.permissionTier ?? 'metadata_only';
  const tableOverride = tablePerms.find(
    (p) => p.dataSourceId === sourceId && p.tableName === tableName,
  )?.permissionOverride;

  let effective: AccessTier = tableOverride
    ? (TIER_RANK[tableOverride] <= TIER_RANK[sourceTier] ? tableOverride : sourceTier)
    : sourceTier;

  if (columnName) {
    const colPerm = columnPerms.find(
      (p) => p.dataSourceId === sourceId && p.tableName === tableName && p.columnName === columnName,
    );
    if (colPerm && colPerm.piiClassification !== 'none') {
      effective = 'metadata_only';
    }
  }

  return effective;
}

export function ExplorePageClient({
  workspaceId,
  tables,
  columns,
  recentChanges,
  sourcePerms,
  tablePerms,
  columnPerms,
}: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const [profilingTable, setProfilingTable] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  const handleRunProfiling = async () => {
    if (!selectedTable) return;
    setProfilingTable(selectedTable.tableName);
    try {
      await fetch(`/api/explore/${workspaceId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: selectedTable.sourceId, tableName: selectedTable.tableName }),
      });
      startTransition(() => router.refresh());
    } finally {
      setProfilingTable(null);
    }
  };

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
              <div className="p-4 flex flex-col items-center gap-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {selectedProfile ? 'Not profiled yet' : 'Profiling in progress…'}
                </p>
                {selectedProfile && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    disabled={profilingTable === selectedTable.tableName}
                    onClick={handleRunProfiling}
                  >
                    {profilingTable === selectedTable.tableName ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Profiling…
                      </>
                    ) : (
                      'Run profiling'
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="flex justify-end px-4 py-2 border-b">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-6"
                    disabled={profilingTable === selectedTable.tableName}
                    onClick={handleRunProfiling}
                  >
                    {profilingTable === selectedTable.tableName ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Profiling…
                      </>
                    ) : (
                      'Re-run profiling'
                    )}
                  </Button>
                </div>
                <div className="divide-y">
                  {selectedColumns.map((col) => {
                    const colPerm = columnPerms.find(
                      (p) =>
                        p.dataSourceId === col.dataSourceId &&
                        p.tableName === col.tableName &&
                        p.columnName === col.columnName,
                    );
                    const effectiveTier = computeEffectiveTier(
                      col.dataSourceId,
                      col.tableName,
                      col.columnName,
                      sourcePerms,
                      tablePerms,
                      columnPerms,
                    );
                    return (
                      <ColumnProfileDetailTab
                        key={col.columnName}
                        profile={{
                          columnName: col.columnName,
                          dataType: col.dataType,
                          dataSourceId: col.dataSourceId,
                          tableName: col.tableName,
                          workspaceId,
                          nullCount: col.nullCount,
                          nullRate: col.nullRate,
                          distinctCount: col.distinctCount,
                          topValuesJson: col.topValuesJson,
                          minValue: col.minValue,
                          maxValue: col.maxValue,
                          meanValue: col.meanValue,
                          percentilesJson: col.percentilesJson,
                          stringLengthDistributionJson: col.stringLengthDistributionJson,
                          piiClassification: colPerm?.piiClassification ?? 'none',
                          piiSubtype: (colPerm?.piiSubtype ?? null) as Parameters<typeof ColumnProfileDetailTab>[0]['profile']['piiSubtype'],
                          effectiveTier,
                        }}
                      />
                    );
                  })}
                </div>
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
        </Tabs>
      )}
    </div>
  );
}
