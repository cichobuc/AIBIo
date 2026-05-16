'use client';

import { Badge } from '@/core/ui/badge';

type ColumnProfile = {
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

type Props = {
  profile: ColumnProfile;
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

export function ColumnProfileDetailTab({ profile }: Props) {
  const isRedacted = profile.topValuesJson === '[REDACTED]';
  const topValues: unknown[] =
    profile.topValuesJson && !isRedacted ? JSON.parse(profile.topValuesJson) : [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">{profile.columnName}</span>
        <Badge variant="secondary" className="text-xs">{profile.dataType}</Badge>
        {profile.piiCandidate && (
          <Badge variant="destructive" className="text-xs">PII candidate</Badge>
        )}
      </div>

      {profile.piiCandidate && profile.piiCandidateReason && (
        <p className="text-xs text-destructive">{profile.piiCandidateReason}</p>
      )}

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
