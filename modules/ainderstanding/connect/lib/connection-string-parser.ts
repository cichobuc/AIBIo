import type { DbDriver, FormCredentials } from '@/core/types/workspace';

export type ParsedConnectionString = {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
};

export function parseConnectionString(
  connectionString: string,
  dbType: DbDriver,
): ParsedConnectionString {
  try {
    switch (dbType) {
      case 'postgres':
        return parsePostgres(connectionString);
      case 'duckdb':
        return { database: connectionString.replace(/^duckdb:\/\//, '') };
      case 'mssql':
        return parseMssql(connectionString);
      case 'mysql':
        return parseMysql(connectionString);
    }
  } catch {
    return {};
  }
}

function parsePostgres(cs: string): ParsedConnectionString {
  // postgresql://user:password@host:port/database
  const url = new URL(cs.replace(/^postgres:\/\//, 'postgresql://'));
  return {
    host: url.hostname || undefined,
    port: url.port ? Number(url.port) : 5432,
    database: url.pathname.slice(1) || undefined,
    user: url.username || undefined,
  };
}

function parseMssql(cs: string): ParsedConnectionString {
  // Server=host,port;Database=db;User Id=user;Password=pass
  const result: ParsedConnectionString = {};
  const serverMatch = /Server=([^,;]+)(?:,(\d+))?/i.exec(cs);
  if (serverMatch) {
    result.host = serverMatch[1];
    if (serverMatch[2]) result.port = Number(serverMatch[2]);
  }
  const dbMatch = /Database=([^;]+)/i.exec(cs);
  if (dbMatch) result.database = dbMatch[1];
  const userMatch = /User Id=([^;]+)/i.exec(cs);
  if (userMatch) result.user = userMatch[1];
  return result;
}

function parseMysql(cs: string): ParsedConnectionString {
  // mysql://user:password@host:port/database
  const url = new URL(cs);
  return {
    host: url.hostname || undefined,
    port: url.port ? Number(url.port) : 3306,
    database: url.pathname.slice(1) || undefined,
    user: url.username || undefined,
  };
}

export function credentialsFromConnectionString(
  connectionString: string,
  dbType: DbDriver,
): Partial<FormCredentials> {
  const parsed = parseConnectionString(connectionString, dbType);
  const defaults: Record<DbDriver, Partial<FormCredentials>> = {
    postgres: { port: 5432 },
    mssql: { port: 1433 },
    mysql: { port: 3306 },
    duckdb: {},
  };
  return { ...defaults[dbType], ...parsed };
}
