import type { DocRecordType } from './agent';

export type PermissionTier =
  | 'metadata_only'
  | 'with_reference_samples'
  | 'with_full_samples'
  | 'with_query_results';

export type ApprovalGateType =
  | 'execute_query'
  | 'share_results_with_ai'
  | 'write_model_file'
  | 'write_test_file'
  | 'write_to_docs';

// Discriminated by gateType from the enclosing ApprovalRequiredEvent.payload.gateType
export type ApprovalGateDetails =
  | { sql: string; dataSourceName: string }                                        // execute_query
  | { rowCount: number; columns: string[]; queryPreview: string }                  // share_results_with_ai
  | { modelName: string; layer: string; sqlDiff: string }                          // write_model_file
  | { testType: 'generic' | 'custom'; modelName: string; testPreview: string }    // write_test_file
  | { recordType: DocRecordType; name: string; description: string };              // write_to_docs

export type ApprovalResult = {
  decision: 'approved' | 'denied';
  requestId: string;
};

export type ApprovalGatePolicy = {
  gateType: ApprovalGateType;
  enabled: boolean;
  autoApprove: boolean;
};

export type PiiSubtype =
  | 'email'
  | 'phone'
  | 'national_id'
  | 'address'
  | 'ip'
  | 'name'
  | 'date_of_birth'
  | 'iban'
  | 'other';
