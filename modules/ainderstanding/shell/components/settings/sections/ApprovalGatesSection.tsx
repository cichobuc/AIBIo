'use client';

import { useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Separator } from '@/core/ui';
import { SettingRow } from '../widgets/SettingRow';
import { SettingRadio } from '../widgets/SettingRadio';
import { TIER_LABELS, TIER_ORDER } from '@/modules/ainderstanding/govern/lib/tier-labels';
import type { ApprovalSettingsRow, PolicyKey } from '@/modules/ainderstanding/govern/lib/types';

type Props = {
  workspaceId: string;
  settings: ApprovalSettingsRow | null;
  onUpdate: (s: ApprovalSettingsRow) => void;
  piiHeuristicsEnabled: boolean;
  onPiiToggle: (v: boolean) => void;
};

const POLICY_ROWS: { key: PolicyKey; label: string; description: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'policyExecuteQuery',
    label: 'Execute query',
    description: 'When the AI wants to run a SELECT query against your data.',
    options: [
      { value: 'always_ask', label: 'Always ask' },
      { value: 'never_ask', label: 'Never ask' },
      { value: 'threshold_based', label: 'Threshold based' },
    ],
  },
  {
    key: 'policyShareResults',
    label: 'Share results with AI',
    description: 'When the AI wants to include query results in its context.',
    options: [
      { value: 'always_ask', label: 'Always ask' },
      { value: 'never_ask', label: 'Never ask' },
      { value: 'auto_reference', label: 'Auto (reference tables)' },
    ],
  },
  {
    key: 'policyWriteToDocs',
    label: 'Write to docs',
    description: 'When the AI wants to write or update documentation.',
    options: [
      { value: 'always_ask', label: 'Always ask' },
      { value: 'threshold_based', label: 'Threshold based' },
      { value: 'never_ask', label: 'Never ask' },
    ],
  },
  {
    key: 'policySchemaIntrospect',
    label: 'Schema introspect',
    description: 'When the AI wants to read table/column metadata.',
    options: [
      { value: 'never_ask', label: 'Never ask' },
      { value: 'always_ask', label: 'Always ask' },
    ],
  },
];

const TIMEOUT_OPTIONS = [60, 120, 180, 300, 600];

const DEFAULTS: ApprovalSettingsRow = {
  policyExecuteQuery: 'always_ask',
  policyShareResults: 'always_ask',
  policyWriteToDocs: 'threshold_based',
  policySchemaIntrospect: 'never_ask',
  approvalTimeoutSec: 300,
  defaultPermissionTierNewSource: 'metadata_only',
};

export function ApprovalGatesSection({ workspaceId, settings, onUpdate, piiHeuristicsEnabled, onPiiToggle }: Props) {
  const [saving, setSaving] = useState(false);

  const current: ApprovalSettingsRow = settings ?? DEFAULTS;

  const patchGovern = useCallback(async (patch: Partial<ApprovalSettingsRow>) => {
    setSaving(true);
    onUpdate({ ...current, ...patch });
    try {
      await fetch(`/api/govern/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  }, [current, onUpdate, workspaceId]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">Approval Gates</h2>
      <Separator className="mb-4" />

      <p className="text-xs text-muted-foreground mb-3">Per-action approval policies</p>
      {POLICY_ROWS.map(({ key, label, description, options }) => (
        <SettingRow key={key} label={label} description={description}>
          <Select
            value={current[key]}
            onValueChange={(v) => void patchGovern({ [key]: v })}
            disabled={saving}
          >
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      ))}

      <Separator className="my-4" />
      <p className="text-xs text-muted-foreground mb-3">Approval timeout</p>
      <SettingRow label="Timeout" description="How long the AI waits for a user approval before treating it as denied.">
        <Select
          value={String(current.approvalTimeoutSec)}
          onValueChange={(v) => void patchGovern({ approvalTimeoutSec: Number(v) })}
          disabled={saving}
        >
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEOUT_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s >= 60 ? `${s / 60} min` : `${s} s`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <Separator className="my-4" />
      <p className="text-xs text-muted-foreground mb-3">New source defaults</p>
      <SettingRow label="Default AI tier" description="AI access tier assigned automatically when a new data source is connected.">
        <Select
          value={current.defaultPermissionTierNewSource}
          onValueChange={(v) => void patchGovern({ defaultPermissionTierNewSource: v as ApprovalSettingsRow['defaultPermissionTierNewSource'] })}
          disabled={saving}
        >
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_ORDER.map((tier) => (
              <SelectItem key={tier} value={tier} className="text-xs">
                {TIER_LABELS[tier]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <Separator className="my-4" />
      <p className="text-xs text-muted-foreground mb-3">PII detection</p>
      <SettingRow label="PII heuristics" description="Automatically detect PII candidates by column name during profiling.">
        <SettingRadio
          name="pii-heuristics"
          value={piiHeuristicsEnabled ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => onPiiToggle(v === 'on')}
        />
      </SettingRow>
    </div>
  );
}
