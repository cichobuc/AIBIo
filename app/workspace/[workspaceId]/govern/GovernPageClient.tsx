'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs';
import { Badge } from '@/core/ui/badge';
import { ScrollArea } from '@/core/ui/scroll-area';

type SourceRow = { id: string; name: string };

type SourcePermission = {
  id: string;
  dataSourceId: string;
  permissionTier: string;
};

type ApprovalSettings = {
  policyExecuteQuery: string;
  policyShareResults: string;
  policyWriteToDocs: string;
  policySchemaIntrospect: string;
  approvalTimeoutSec: number;
};

type AuditEntry = {
  id: string;
  agentName: string;
  actionType: string;
  tableName: string | null;
  outcome: string;
  createdAt: string;
};

type PiiColumn = {
  dataSourceId: string;
  tableName: string;
  columnName: string;
  piiClassification: string;
  piiSubtype: string | null;
};

type Props = {
  workspaceId: string;
  sources: SourceRow[];
  permissions: SourcePermission[];
  settings: ApprovalSettings | null;
  audits: AuditEntry[];
  piiColumns: PiiColumn[];
};

const OUTCOME_STYLES: Record<string, string> = {
  allowed: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  approval_granted: 'bg-blue-100 text-blue-700',
  approval_denied: 'bg-orange-100 text-orange-700',
  timeout: 'bg-yellow-100 text-yellow-700',
};

export function GovernPageClient({
  workspaceId,
  sources,
  permissions,
  settings,
  audits,
  piiColumns,
}: Props) {
  const permissionMap = new Map(permissions.map((p) => [p.dataSourceId, p]));

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="permissions" className="flex flex-col h-full">
        <div className="border-b px-4 pt-3">
          <TabsList className="h-7">
            <TabsTrigger value="permissions" className="text-xs">Permissions</TabsTrigger>
            <TabsTrigger value="pii" className="text-xs">
              PII Inventory
              {piiColumns.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                  {piiColumns.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">Audit Log</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="permissions" className="flex-1 overflow-auto m-0 p-4 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2">Source permissions</h3>
            {sources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data sources connected</p>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => {
                  const perm = permissionMap.get(source.id);
                  return (
                    <div key={source.id} className="flex items-center gap-3 text-xs border rounded p-2">
                      <span className="flex-1 font-medium">{source.name}</span>
                      <Badge variant="secondary">{perm?.permissionTier ?? 'metadata_only'}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {settings && (
            <section>
              <h3 className="text-xs font-semibold text-foreground mb-2">Approval policies</h3>
              <div className="space-y-1.5 text-xs">
                {(
                  [
                    ['Execute query', settings.policyExecuteQuery],
                    ['Share results', settings.policyShareResults],
                    ['Write to docs', settings.policyWriteToDocs],
                    ['Schema introspect', settings.policySchemaIntrospect],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-36">{label}</span>
                    <Badge variant="outline">{value}</Badge>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground w-36">Timeout</span>
                  <span>{settings.approvalTimeoutSec}s</span>
                </div>
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="pii" className="flex-1 overflow-auto m-0 p-4">
          {piiColumns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No PII-classified columns yet. Run schema discovery and profiling to detect candidates.
            </p>
          ) : (
            <div className="space-y-1">
              {piiColumns.map((col, i) => {
                const source = sources.find((s) => s.id === col.dataSourceId);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs border-b py-1.5">
                    <span className="text-muted-foreground w-28 overflow-hidden text-ellipsis whitespace-nowrap shrink-0">
                      {source?.name ?? col.dataSourceId.slice(0, 8)}
                    </span>
                    <span className="font-mono overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                      {col.tableName}.<span className="text-destructive">{col.columnName}</span>
                    </span>
                    <Badge variant="destructive" className="text-[10px] shrink-0">{col.piiClassification}</Badge>
                    {col.piiSubtype && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{col.piiSubtype}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {audits.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No audit entries yet</p>
              ) : (
                <div className="space-y-1">
                  {audits.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 text-xs border-b py-1.5">
                      <span className="text-muted-foreground text-[10px] shrink-0 w-20">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="text-muted-foreground w-28 overflow-hidden text-ellipsis whitespace-nowrap shrink-0">
                        {entry.agentName}
                      </span>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                        {entry.actionType}
                        {entry.tableName && (
                          <span className="text-muted-foreground"> · {entry.tableName}</span>
                        )}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          OUTCOME_STYLES[entry.outcome] ?? 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {entry.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
