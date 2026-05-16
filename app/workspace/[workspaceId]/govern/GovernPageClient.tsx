'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { PIIInventoryDashboard } from '@/modules/ainderstanding/govern/components/PIIInventoryDashboard';
import { ClassifyColumnSheet } from '@/modules/ainderstanding/govern/components/ClassifyColumnSheet';
import { BulkClassifySheet } from '@/modules/ainderstanding/govern/components/BulkClassifySheet';
import { AuditLogViewer } from '@/modules/ainderstanding/govern/components/AuditLogViewer';
import type { PiiInventoryRow } from '@/modules/ainderstanding/govern/components/PIIInventoryDashboard';
import type { ClassifyColumnTarget } from '@/modules/ainderstanding/govern/components/ClassifyColumnSheet';
import type { AuditEntryFull } from '@/modules/ainderstanding/govern/components/AuditEntryDetailSheet';

type SourceRow = { id: string; name: string };

type HighlightTarget = {
  dataSourceId: string;
  tableName: string;
  columnName: string;
};

type Props = {
  workspaceId: string;
  sources: SourceRow[];
  audits: AuditEntryFull[];
  piiColumns: PiiInventoryRow[];
  auditFilters?: { agent?: string; action?: string; outcome?: string; q?: string };
  defaultTab?: string;
  highlight?: HighlightTarget;
};

export function GovernPageClient({
  workspaceId,
  sources,
  audits,
  piiColumns,
  auditFilters = {},
  defaultTab,
  highlight,
}: Props) {
  const router = useRouter();
  const [classifyTarget, setClassifyTarget] = useState<ClassifyColumnTarget | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const needsReview = piiColumns.filter((r) => r.setBy === 'heuristic');
  const totalPii = piiColumns.length;

  const openClassify = (row: PiiInventoryRow) => {
    setClassifyTarget({
      workspaceId,
      dataSourceId: row.dataSourceId,
      tableName: row.tableName,
      columnName: row.columnName,
      piiClassification: (row.piiClassification as 'none' | 'pii' | 'sensitive') ?? 'none',
      piiSubtype: row.piiSubtype as 'email' | 'phone' | 'national_id' | 'address' | 'ip' | 'name' | 'date_of_birth' | 'iban' | 'other' | null,
    });
  };

  const resolvedTab = defaultTab === 'permissions' ? 'pii' : (defaultTab ?? 'pii');

  return (
    <>
      <div className="h-full flex flex-col">
        <Tabs defaultValue={resolvedTab} className="flex flex-col h-full">
          <div className="border-b px-4 pt-3 flex items-center gap-2">
            <TabsList className="h-7">
              <TabsTrigger value="pii" className="text-xs">
                PII Inventory
                {totalPii > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                    {totalPii}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs">Audit Log</TabsTrigger>
            </TabsList>
            {needsReview.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] ml-auto"
                onClick={() => setBulkOpen(true)}
              >
                Bulk classify ({needsReview.length})
              </Button>
            )}
          </div>

          <TabsContent value="pii" className="flex-1 overflow-auto m-0 p-4">
            <PIIInventoryDashboard
              workspaceId={workspaceId}
              sources={sources}
              piiColumns={piiColumns}
              onEdit={openClassify}
              onRefresh={() => router.refresh()}
              highlight={highlight}
            />
          </TabsContent>

          <TabsContent value="audit" className="flex-1 m-0 p-4 overflow-hidden flex flex-col">
            <AuditLogViewer audits={audits} currentFilters={auditFilters} />
          </TabsContent>
        </Tabs>
      </div>

      <ClassifyColumnSheet target={classifyTarget} onClose={() => setClassifyTarget(null)} />
      <BulkClassifySheet
        workspaceId={workspaceId}
        open={bulkOpen}
        rows={needsReview}
        onClose={() => setBulkOpen(false)}
      />
    </>
  );
}
