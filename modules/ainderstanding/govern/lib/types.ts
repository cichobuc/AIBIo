import type { PermissionTierValue } from '../db/schema';

export type SourceRow = { id: string; name: string };

export type SourcePermissionRow = {
  dataSourceId: string;
  permissionTier: PermissionTierValue;
};

export type TablePermissionRow = {
  id: string;
  dataSourceId: string;
  tableName: string;
  permissionOverride: PermissionTierValue | null;
};

export type ApprovalSettingsRow = {
  policyExecuteQuery: 'always_ask' | 'never_ask' | 'threshold_based';
  policyShareResults: 'always_ask' | 'never_ask' | 'auto_reference';
  policyWriteToDocs: 'always_ask' | 'threshold_based' | 'never_ask';
  policySchemaIntrospect: 'never_ask' | 'always_ask';
  approvalTimeoutSec: number;
  defaultPermissionTierNewSource: PermissionTierValue;
};

export type PolicyKey = keyof Pick<
  ApprovalSettingsRow,
  'policyExecuteQuery' | 'policyShareResults' | 'policyWriteToDocs' | 'policySchemaIntrospect'
>;
