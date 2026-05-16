'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/core/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import type { AccessTier } from './schema-tree/types';

type PiiClassification = 'none' | 'pii' | 'sensitive';
type PiiSubtype = 'email' | 'phone' | 'national_id' | 'address' | 'ip' | 'name' | 'date_of_birth' | 'iban' | 'other';

export type ColumnProfile = {
  columnName: string;
  dataType: string;
  dataSourceId: string;
  tableName: string;
  workspaceId: string;
  nullCount: number | null;
  nullRate: number | null;
  distinctCount: number | null;
  topValuesJson: string | null;
  minValue: string | null;
  maxValue: string | null;
  meanValue: number | null;
  percentilesJson: string | null;
  stringLengthDistributionJson: string | null;
  piiClassification: PiiClassification;
  piiSubtype: PiiSubtype | null;
  effectiveTier: AccessTier;
};

type Props = {
  profile: ColumnProfile;
};

const TIER_LABELS: Record<AccessTier, string> = {
  metadata_only: 'Metadata only',
  with_reference_samples: 'Ref samples',
  with_full_samples: 'Full samples',
  with_query_results: 'Full + queries',
};

const TIER_COLORS: Record<AccessTier, string> = {
  metadata_only: 'text-muted-foreground',
  with_reference_samples: 'text-amber-500',
  with_full_samples: 'text-blue-500',
  with_query_results: 'text-green-600',
};

const PII_SUBTYPE_LABELS: Record<PiiSubtype, string> = {
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

function NullRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

type PercentileData = { p25: number; p50: number; p75: number; p95: number };

function NumericHistogram({ percentilesJson }: { percentilesJson: string }) {
  let data: PercentileData | null = null;
  try { data = JSON.parse(percentilesJson) as PercentileData; } catch { return null; }
  if (!data) return null;

  const bars = [
    { label: 'p25', value: data.p25 },
    { label: 'p50', value: data.p50 },
    { label: 'p75', value: data.p75 },
    { label: 'p95', value: data.p95 },
  ];
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">Percentiles</div>
      <div className="flex items-end gap-1 h-12">
        {bars.map((bar) => (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-primary/60 rounded-t-sm"
              style={{ height: `${(Math.abs(bar.value) / max) * 40}px` }}
            />
            <span className="text-[9px] text-muted-foreground">{bar.label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1 justify-between">
        {bars.map((bar) => (
          <span key={bar.label} className="flex-1 text-[9px] text-muted-foreground text-center overflow-hidden text-ellipsis whitespace-nowrap">
            {typeof bar.value === 'number' ? bar.value.toFixed(1) : bar.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function LengthHistogram({ distJson }: { distJson: string }) {
  let data: Record<string, number> | null = null;
  try { data = JSON.parse(distJson) as Record<string, number>; } catch { return null; }
  if (!data || Object.keys(data).length === 0) return null;

  const entries = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
  const max = Math.max(...entries.map(([, v]) => Number(v)), 1);

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">String length distribution</div>
      <div className="flex items-end gap-0.5 h-10">
        {entries.map(([bucket, count]) => (
          <div key={bucket} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-accent-ai/60 rounded-t-sm"
              style={{ height: `${(Number(count) / max) * 32}px` }}
            />
            <span className="text-[9px] text-muted-foreground">{bucket}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColumnProfileDetailTab({ profile }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [piiClass, setPiiClass] = useState<PiiClassification>(profile.piiClassification);
  const [piiSubtype, setPiiSubtype] = useState<PiiSubtype | ''>(profile.piiSubtype ?? '');

  const isRedacted = profile.topValuesJson === '[REDACTED]';
  const topValues: unknown[] =
    profile.topValuesJson && !isRedacted ? JSON.parse(profile.topValuesJson) : [];

  const savePiiClassification = async (classification: PiiClassification, subtype?: PiiSubtype | '') => {
    await fetch('/api/govern/column-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: profile.workspaceId,
        dataSourceId: profile.dataSourceId,
        tableName: profile.tableName,
        columnName: profile.columnName,
        piiClassification: classification,
        piiSubtype: subtype || undefined,
        setBy: 'user',
      }),
    });
    startTransition(() => router.refresh());
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">{profile.columnName}</span>
        <Badge variant="secondary" className="text-xs">{profile.dataType}</Badge>
        <span className={`text-[10px] font-medium ${TIER_COLORS[profile.effectiveTier]}`}>
          {TIER_LABELS[profile.effectiveTier]}
        </span>
      </div>

      {/* PII classification controls */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">AI access</div>
        <div className="flex items-center gap-2">
          <Select
            value={piiClass}
            onValueChange={(val) => {
              const v = val as PiiClassification;
              setPiiClass(v);
              if (v === 'none') setPiiSubtype('');
              void savePiiClassification(v, v === 'none' ? '' : piiSubtype);
            }}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">Allowed</SelectItem>
              <SelectItem value="sensitive" className="text-xs">Sensitive</SelectItem>
              <SelectItem value="pii" className="text-xs">PII — blocked</SelectItem>
            </SelectContent>
          </Select>

          {piiClass !== 'none' && (
            <Select
              value={piiSubtype}
              onValueChange={(val) => {
                const v = val as PiiSubtype;
                setPiiSubtype(v);
                void savePiiClassification(piiClass, v);
              }}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Subtype (optional)" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PII_SUBTYPE_LABELS) as [PiiSubtype, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {profile.distinctCount != null && (
          <div>
            <div className="text-muted-foreground">Distinct</div>
            <div className="font-medium">{profile.distinctCount.toLocaleString()}</div>
          </div>
        )}
        {profile.minValue && (
          <div>
            <div className="text-muted-foreground">Min</div>
            <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap">{profile.minValue}</div>
          </div>
        )}
        {profile.maxValue && (
          <div>
            <div className="text-muted-foreground">Max</div>
            <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap">{profile.maxValue}</div>
          </div>
        )}
        {profile.meanValue != null && (
          <div>
            <div className="text-muted-foreground">Mean</div>
            <div className="font-medium">{profile.meanValue.toFixed(2)}</div>
          </div>
        )}
      </div>

      {profile.nullRate != null && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Null rate</div>
          <NullRateBar rate={profile.nullRate} />
        </div>
      )}

      {profile.percentilesJson && (
        <NumericHistogram percentilesJson={profile.percentilesJson} />
      )}

      {profile.stringLengthDistributionJson && (
        <LengthHistogram distJson={profile.stringLengthDistributionJson} />
      )}

      {!isRedacted && topValues.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Top values</div>
          <div className="flex flex-wrap gap-1">
            {topValues.slice(0, 15).map((v, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-mono">
                {String(v)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {isRedacted && (
        <div className="text-xs text-muted-foreground italic">Top values redacted (PII column)</div>
      )}
    </div>
  );
}
