import { Pool } from 'pg';
import type { SourceAdapter } from './base';
import type {
  ConnectionTestResult,
  SchemaSnapshot,
  SchemaTable,
  SchemaColumn,
  NativeComment,
  QueryResult,
  FormCredentials,
  ConnectionStringCredentials,
  ConnectionSettings,
} from '@/core/types/workspace';
import { validateSelectOnly } from '../sql-gate';

type PostgresCredentials = FormCredentials | ConnectionStringCredentials;

export class PostgresAdapter implements SourceAdapter {
  private readonly pool: Pool;

  constructor(credentials: PostgresCredentials, settings: ConnectionSettings) {
    const timeout = (settings.query_timeout_sec ?? 30) * 1000;

    if ('connection_string' in credentials) {
      this.pool = new Pool({
        connectionString: credentials.connection_string,
        max: settings.max_connections ?? 5,
        connectionTimeoutMillis: 10_000,
        statement_timeout: timeout,
        ssl: settings.ssl_mode === 'require' ? { rejectUnauthorized: false } : undefined,
      });
    } else {
      this.pool = new Pool({
        host: credentials.host,
        port: credentials.port,
        user: credentials.user,
        password: credentials.password,
        database: credentials.database,
        max: settings.max_connections ?? 5,
        connectionTimeoutMillis: 10_000,
        statement_timeout: timeout,
        ssl:
          settings.ssl_mode && settings.ssl_mode !== 'disable'
            ? { rejectUnauthorized: settings.ssl_mode === 'require' }
            : undefined,
      });
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    let client;
    try {
      client = await this.pool.connect();
    } catch (err) {
      return {
        success: false,
        step: 'connect',
        error: 'SOURCE_UNREACHABLE',
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      await client.query('SELECT 1');
      return { success: true, step: 'complete', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        step: 'query',
        error: 'QUERY_FAILED',
        detail: err instanceof Error ? err.message : String(err),
      };
    } finally {
      client.release();
    }
  }

  async introspectSchema(): Promise<SchemaSnapshot> {
    const client = await this.pool.connect();
    try {
      const tablesRes = await client.query<{ table_schema: string; table_name: string }>(
        `SELECT table_schema, table_name
         FROM information_schema.tables
         WHERE table_schema NOT IN ('pg_catalog','information_schema')
           AND table_type = 'BASE TABLE'
         ORDER BY table_schema, table_name`,
      );

      const columnsRes = await client.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `SELECT table_schema, table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema NOT IN ('pg_catalog','information_schema')
         ORDER BY table_schema, table_name, ordinal_position`,
      );

      const pkRes = await client.query<{ table_schema: string; table_name: string; column_name: string }>(
        `SELECT tc.table_schema, tc.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'`,
      );

      const pkSet = new Set(pkRes.rows.map((r) => `${r.table_schema}.${r.table_name}.${r.column_name}`));

      const colsByTable = new Map<string, SchemaColumn[]>();
      for (const col of columnsRes.rows) {
        const key = `${col.table_schema}.${col.table_name}`;
        if (!colsByTable.has(key)) colsByTable.set(key, []);
        colsByTable.get(key)!.push({
          name: col.column_name,
          dataType: col.data_type,
          nullable: col.is_nullable === 'YES',
          isPrimaryKey: pkSet.has(`${col.table_schema}.${col.table_name}.${col.column_name}`),
          isForeignKey: false,
        });
      }

      const tables: SchemaTable[] = tablesRes.rows.map((t) => ({
        name: t.table_name,
        schema: t.table_schema,
        columns: colsByTable.get(`${t.table_schema}.${t.table_name}`) ?? [],
      }));

      return { tables, capturedAt: new Date().toISOString() };
    } finally {
      client.release();
    }
  }

  async executeSelect(sql: string): Promise<QueryResult> {
    validateSelectOnly(sql);
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql);
      return {
        columns: result.fields.map((f) => f.name),
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? result.rows.length,
      };
    } finally {
      client.release();
    }
  }

  async readNativeComments(): Promise<NativeComment[]> {
    const client = await this.pool.connect();
    try {
      const tableComments = await client.query<{
        table_schema: string;
        table_name: string;
        obj_description: string;
      }>(
        `SELECT n.nspname AS table_schema, c.relname AS table_name,
                obj_description(c.oid) AS obj_description
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r'
           AND n.nspname NOT IN ('pg_catalog','information_schema')
           AND obj_description(c.oid) IS NOT NULL`,
      );

      const colComments = await client.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        col_description: string;
      }>(
        `SELECT n.nspname AS table_schema, c.relname AS table_name,
                a.attname AS column_name,
                col_description(c.oid, a.attnum) AS col_description
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE a.attnum > 0
           AND NOT a.attisdropped
           AND n.nspname NOT IN ('pg_catalog','information_schema')
           AND col_description(c.oid, a.attnum) IS NOT NULL`,
      );

      const comments: NativeComment[] = [
        ...tableComments.rows.map((r) => ({
          objectType: 'table' as const,
          tableName: r.table_name,
          comment: r.obj_description,
        })),
        ...colComments.rows.map((r) => ({
          objectType: 'column' as const,
          tableName: r.table_name,
          columnName: r.column_name,
          comment: r.col_description,
        })),
      ];

      return comments;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
