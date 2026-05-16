export type WorkspaceId = string;
export type DataSourceId = string;

export type AIMode = 'auto' | 'documentation' | 'queries' | 'manual';

export type DbDriver = 'postgres' | 'mssql' | 'mysql' | 'duckdb';
export type ConnectionMode = 'form' | 'connection_string';
export type DataSourceStatus = 'active' | 'error' | 'pending';
export type SslMode = 'disable' | 'allow' | 'prefer' | 'require';
export type FormCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
};

export type ConnectionStringCredentials = {
  connection_string: string;
};

export type ConnectionCredentials = FormCredentials | ConnectionStringCredentials;

export type ConnectionSettings = {
  ssl_mode?: SslMode;
  query_timeout_sec?: number | null;
  max_connections?: number;
};

export type DataSource = {
  id: DataSourceId;
  workspaceId: WorkspaceId;
  name: string;
  dbType: DbDriver;
  connectionMode: ConnectionMode;
  connectionSettingsJson: ConnectionSettings | null;
  status: DataSourceStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Workspace = {
  id: WorkspaceId;
  name: string;
  description: string | null;
  aiMode: AIMode;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SchemaColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  comment?: string;
};

export type SchemaTable = {
  name: string;
  schema?: string;
  columns: SchemaColumn[];
  comment?: string;
};

export type SchemaView = {
  name: string;
  schema?: string;
  definitionPreview?: string;
  columns: SchemaColumn[];
};

export type SchemaRoutine = {
  name: string;
  schema?: string;
  kind: 'function' | 'procedure';
  returnType?: string;
};

export type SchemaIndex = {
  name: string;
  schema?: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
};

export type SchemaSnapshot = {
  tables: SchemaTable[];
  views?: SchemaView[];
  routines?: SchemaRoutine[];
  indexes?: SchemaIndex[];
  schemas?: string[];
  capturedAt: string;
};

export type NativeComment = {
  objectType: 'table' | 'column';
  tableName: string;
  columnName?: string;
  comment: string;
};

export type ConnectionTestResult = {
  success: boolean;
  latencyMs?: number;
  step: string;
  error?: string;
  detail?: string;
};

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
};

export type SqlRejectedError = {
  code: 'SQL_REJECTED';
  reason: string;
  statement_type: string;
};
