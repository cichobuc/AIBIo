import { Shield, EyeOff, Eye, Unlock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PermissionTierValue } from '../db/schema';

export const TIER_LABELS: Record<PermissionTierValue, string> = {
  metadata_only: 'Metadata only',
  with_reference_samples: '+ Reference samples',
  with_full_samples: '+ Full samples',
  with_query_results: '+ Query results',
};

export const TIER_DESCRIPTIONS: Record<PermissionTierValue, string> = {
  metadata_only: 'AI sees schema only — no row data',
  with_reference_samples: 'AI can read rows from reference tables',
  with_full_samples: 'AI can read sample rows from any table',
  with_query_results: 'AI can run SELECT queries (with per-query approval)',
};

export type TierIconSpec = { icon: LucideIcon; className: string };

export const TIER_ICONS: Record<PermissionTierValue, TierIconSpec> = {
  metadata_only: { icon: Shield, className: 'text-muted-foreground/60' },
  with_reference_samples: { icon: EyeOff, className: 'text-amber-400' },
  with_full_samples: { icon: Eye, className: 'text-blue-400' },
  with_query_results: { icon: Unlock, className: 'text-green-500' },
};

export const TIER_ORDER: PermissionTierValue[] = [
  'metadata_only',
  'with_reference_samples',
  'with_full_samples',
  'with_query_results',
];
