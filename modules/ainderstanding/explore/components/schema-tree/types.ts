import type { DataSourceStatus, DbDriver } from '@/core/types/workspace';

export type TreeNodeKind = 'connection' | 'schema' | 'group' | 'table' | 'view' | 'column' | 'routine' | 'index';
export type GroupType = 'tables' | 'views' | 'routines' | 'indexes';

export type AccessTier = 'metadata_only' | 'with_reference_samples' | 'with_full_samples' | 'with_query_results';
export type PiiClassification = 'none' | 'pii' | 'sensitive';

type BaseNode = { id: string };

export type ConnectionNode = BaseNode & {
  kind: 'connection';
  sourceId: string;
  name: string;
  status: DataSourceStatus;
  dbType: DbDriver;
  effectiveTier: AccessTier;
  children: TreeNode[];
};

export type SchemaNode = BaseNode & {
  kind: 'schema';
  sourceId: string;
  schemaName: string;
  children: TreeNode[];
};

export type GroupNode = BaseNode & {
  kind: 'group';
  sourceId: string;
  schemaName: string;
  groupType: GroupType;
  count: number;
  children: TreeNode[];
};

export type TableNode = BaseNode & {
  kind: 'table';
  sourceId: string;
  schemaName: string;
  tableName: string;
  rowCount: number | null;
  isReferenceTable: boolean;
  effectiveTier: AccessTier;
  children: TreeNode[];
};

export type ViewNode = BaseNode & {
  kind: 'view';
  sourceId: string;
  schemaName: string;
  viewName: string;
  children: TreeNode[];
};

export type ColumnNode = BaseNode & {
  kind: 'column';
  sourceId: string;
  schemaName: string;
  parentName: string;
  columnName: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  piiClassification: PiiClassification;
  piiSubtype: string | null;
  effectiveTier: AccessTier;
};

export type RoutineNode = BaseNode & {
  kind: 'routine';
  sourceId: string;
  schemaName: string;
  routineName: string;
  routineKind: 'function' | 'procedure';
  returnType?: string;
};

export type IndexNode = BaseNode & {
  kind: 'index';
  sourceId: string;
  schemaName: string;
  indexName: string;
  tableName: string;
  isUnique: boolean;
  isPrimary: boolean;
};

export type TreeNode =
  | ConnectionNode
  | SchemaNode
  | GroupNode
  | TableNode
  | ViewNode
  | ColumnNode
  | RoutineNode
  | IndexNode;

export type ContextAction =
  | 'add-connection'
  | 'new-query-here'
  | 'edit'
  | 'test'
  | 'remove'
  | 'refresh-schema'
  | 'copy-name'
  | 'open-in-explore'
  | 'set-tier-metadata'
  | 'set-tier-reference'
  | 'set-tier-full'
  | 'set-tier-query'
  | 'clear-table-override'
  | 'set-pii-none'
  | 'set-pii-pii'
  | 'set-pii-sensitive';
