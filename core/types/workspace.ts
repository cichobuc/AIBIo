export type WorkspaceId = string;
export type DataSourceId = string;

export type DbDriver = 'postgres' | 'mssql' | 'mysql' | 'duckdb';

export type ConnectionConfig = {
  driver: DbDriver;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  filePath?: string;
};

export type Workspace = {
  id: WorkspaceId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DataSource = {
  id: DataSourceId;
  workspaceId: WorkspaceId;
  name: string;
  driver: DbDriver;
  connectionConfig: ConnectionConfig;
  createdAt: Date;
  updatedAt: Date;
};
