'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Badge } from '@/core/ui/badge';
import { TableOverrideDialog } from './TableOverrideDialog';
import type { PermissionTierValue } from '@/modules/ainderstanding/govern/db/schema';

const TIER_LABELS: Record<PermissionTierValue, string> = {
  metadata_only: 'Metadata only',
  with_reference_samples: '+ Reference samples',
  with_full_samples: '+ Full samples',
  with_query_results: '+ Query results',
};

const TIER_DESCS: Record<PermissionTierValue, string> = {
  metadata_only: 'AI sees schema only — no row data',
  with_reference_samples: 'AI can read rows from reference tables',
  with_full_samples: 'AI can read sample rows from any table',
  with_query_results: 'AI can run SELECT queries (with per-query approval)',
};

const TIERS = Object.keys(TIER_LABELS) as PermissionTierValue[];

export type SourceRow = { id: string; name: string };
export type SourcePermissionRow = { dataSourceId: string; permissionTier: PermissionTierValue };
export type TablePermissionRow = { id: string; dataSourceId: string; tableName: string; permissionOverride: PermissionTierValue | null };

export type ApprovalSettingsRow = {
  policyExecuteQuery: 'always_ask' | 'never_ask' | 'threshold_based';
  policyShareResults: 'always_ask' | 'never_ask' | 'auto_reference';
  policyWriteToDocs: 'always_ask' | 'threshold_based' | 'never_ask';
  policySchemaIntrospect: 'never_ask' | 'always_ask';
  approvalTimeoutSec: number;
  defaultPermissionTierNewSource: PermissionTierValue;
};

type Props = {
  workspaceId: string;
  sources: SourceRow[];
  permissions: SourcePermissionRow[];
  tablePermissions: TablePermissionRow[];
  settings: ApprovalSettingsRow | null;
};

type PolicyKey = keyof Pick<
  ApprovalSettingsRow,
  'policyExecuteQuery' | 'policyShareResults' | 'policyWriteToDocs' | 'policySchemaIntrospect'
>;

const POLICY_ROWS: { key: PolicyKey; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'policyExecuteQuery',
    label: 'Execute query',
    options: [
      { value: 'always_ask', label: 'Always ask' },
      { value: 'never_ask', label: 'Never ask' },
      { value: 'threshold_based', label: 'Threshold based' },
    ],
  },
  {
    key: 'policyShareResults',
    label: 'Share results with AI',
    options: [
      { value: 'always_ask', label: 'Always ask' },
      { value: 'never_ask', label: 'Never ask' },
      { value: 'auto_reference', label: 'Auto (reference tables)' },
    ],
  },
  {
    key: 'policyWriteToDocs',
    label: 'Write to docs',
    options: [
      { value: 'always_ask', label: 'Always ask' },
      { value: 'threshold_based', label: 'Threshold based' },
      { value: 'never_ask', label: 'Never ask' },
    ],
  },
  {
    key: 'policySchemaIntrospect',
    label: 'Schema introspect',
    options: [
      { value: 'never_ask', label: 'Never ask' },
      { value: 'always_ask', label: 'Always ask' },
    ],
  },
];

function SourceSection({
  workspaceId,
  source,
  currentTier,
  tableOverrides,
}: {
  workspaceId: string;
  source: SourceRow;
  currentTier: PermissionTierValue;
  tableOverrides: TablePermissionRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const saveTier = async (tier: PermissionTierValue) => {
    await fetch('/api/govern/source-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, dataSourceId: source.id, permissionTier: tier }),
    });
    startTransition(() => router.refresh());
  };

  const removeOverride = async (tableName: string) => {
    await fetch('/api/govern/table-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, dataSourceId: source.id, tableName, permissionOverride: null }),
    });
    startTransition(() => router.refresh());
  };

  const saveOverride = async (tableName: string, tier: PermissionTierValue) => {
    await fetch('/api/govern/table-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, dataSourceId: source.id, tableName, permissionOverride: tier }),
    });
    startTransition(() => router.refresh());
  };

  return (
    <div className="border rounded-md">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex-1 text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap">{source.name}</span>
        <Select value={currentTier} onValueChange={(v) => void saveTier(v as PermissionTierValue)}>
          <SelectTrigger className="h-7 text-xs w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIERS.map((tier) => (
              <SelectItem key={tier} value={tier} className="text-xs">
                <div>
                  <div>{TIER_LABELS[tier]}</div>
                  <div className="text-muted-foreground text-[10px]">{TIER_DESCS[tier]}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setExpanded((e) => !e)}
          title="Table overrides"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-1.5 bg-muted/20">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Table overrides</div>
          {tableOverrides.length === 0 && (
            <p className="text-xs text-muted-foreground">No table overrides — all tables follow source tier.</p>
          )}
          {tableOverrides.map((ovr) => (
            <div key={ovr.id} className="flex items-center gap-2">
              <span className="flex-1 text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap">{ovr.tableName}</span>
              <Select
                value={ovr.permissionOverride ?? ''}
                onValueChange={(v) => void saveOverride(ovr.tableName, v as PermissionTierValue)}
              >
                <SelectTrigger className="h-6 text-[11px] w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{TIER_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => void removeOverride(ovr.tableName)}
                title="Remove override"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] mt-1"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add override
          </Button>
          <TableOverrideDialog
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSave={(tableName, tier) => {
              setAddOpen(false);
              void saveOverride(tableName, tier);
            }}
            existingTables={tableOverrides.map((o) => o.tableName)}
          />
        </div>
      )}
    </div>
  );
}

export function PermissionsPanel({ workspaceId, sources, permissions, tablePermissions, settings }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const permMap = new Map(permissions.map((p) => [p.dataSourceId, p.permissionTier]));
  const tableOverridesBySrc = new Map<string, TablePermissionRow[]>();
  for (const t of tablePermissions) {
    const list = tableOverridesBySrc.get(t.dataSourceId) ?? [];
    list.push(t);
    tableOverridesBySrc.set(t.dataSourceId, list);
  }

  const patchSettings = async (patch: Partial<ApprovalSettingsRow>) => {
    await fetch(`/api/govern/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    startTransition(() => router.refresh());
  };

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <p className="text-xs text-muted-foreground">No data sources connected.</p>
        <a
          href={`/workspace/${workspaceId}/connect`}
          className="text-xs text-primary underline underline-offset-2"
        >
          Go to Connect →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold mb-2">Source permission tiers</h3>
        <div className="space-y-2">
          {sources.map((source) => (
            <SourceSection
              key={source.id}
              workspaceId={workspaceId}
              source={source}
              currentTier={permMap.get(source.id) ?? 'metadata_only'}
              tableOverrides={tableOverridesBySrc.get(source.id) ?? []}
            />
          ))}
        </div>
      </section>

      {settings && (
        <section>
          <h3 className="text-xs font-semibold mb-2">Approval policies</h3>
          <div className="space-y-2">
            {POLICY_ROWS.map(({ key, label, options }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-44">{label}</span>
                <Select
                  value={settings[key]}
                  onValueChange={(v) => void patchSettings({ [key]: v })}
                >
                  <SelectTrigger className="h-7 text-xs w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-44">Approval timeout</span>
              <div className="flex items-center gap-2">
                <Select
                  value={String(settings.approvalTimeoutSec)}
                  onValueChange={(v) => void patchSettings({ approvalTimeoutSec: Number(v) })}
                >
                  <SelectTrigger className="h-7 text-xs w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[60, 120, 180, 300, 600].map((s) => (
                      <SelectItem key={s} value={String(s)} className="text-xs">{s}s</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-44">Default tier (new sources)</span>
              <Select
                value={settings.defaultPermissionTierNewSource}
                onValueChange={(v) => void patchSettings({ defaultPermissionTierNewSource: v as PermissionTierValue })}
              >
                <SelectTrigger className="h-7 text-xs w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{TIER_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      )}

      {!settings && (
        <p className="text-xs text-muted-foreground italic">
          Approval settings not yet initialised — interact with any tier dropdown to auto-create.
        </p>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <Badge variant="outline" className="text-[10px]">Auto-save</Badge>
        <span className="text-[10px] text-muted-foreground">Changes apply immediately — no Save button needed.</span>
      </div>
    </div>
  );
}
