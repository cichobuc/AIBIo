import { Database } from 'duckdb-async';
import type { SourceAdapter } from './base';
import type {
  ConnectionTestResult,
  SchemaSnapshot,
  SchemaTable,
  SchemaColumn,
  NativeComment,
  QueryResult,
  ConnectionSettings,
} from '@/core/types/workspace';
import { validateSelectOnly } from '../sql-gate';

type DuckDbCredentials = {
  file_path: string;
};

type RowData = Record<string, unknown>;

export class DuckDbAdapter implements SourceAdapter {
  private readonly filePath: string;
  private readonly timeoutMs: number;

  constructor(credentials: DuckDbCredentials, settings: ConnectionSettings) {
    this.filePath = credentials.file_path;
    this.timeoutMs = (settings.query_timeout_sec ?? 30) * 1000;
  }

  private async openDb(): Promise<Database> {
    return Database.create(this.filePath, { access_mode: 'READ_ONLY' });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    let db: Database | undefined;
    try {
      db = await this.openDb();
      await db.all('SELECT 1');
      return { success: true, step: 'complete', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        step: 'connect',
        error: 'SOURCE_UNREACHABLE',
        detail: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await db?.close();
    }
  }

  async introspectSchema(): Promise<SchemaSnapshot> {
    const db = await this.openDb();
    try {
      const schemasRes = (await db.all(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('information_schema','pg_catalog')`,
      )) as RowData[];

      const tables: SchemaTable[] = [];

      for (const schemaRow of schemasRes) {
        const schema_name = schemaRow['schema_name'] as string;
        const tablesRes = (await db.all(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = ? AND table_type = 'BASE TABLE'
           ORDER BY table_name`,
          schema_name,
        )) as RowData[];

        for (const tableRow of tablesRes) {
          const table_name = tableRow['table_name'] as string;
          const colsRes = (await db.all(
            `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
             WHERE table_schema = ? AND table_name = ?
             ORDER BY ordinal_position`,
            schema_name,
            table_name,
          )) as RowData[];

          const columns: SchemaColumn[] = colsRes.map((c) => ({
            name: c['column_name'] as string,
            dataType: c['data_type'] as string,
            nullable: c['is_nullable'] === 'YES',
            isPrimaryKey: false,
            isForeignKey: false,
          }));

          tables.push({ name: table_name, schema: schema_name, columns });
        }
      }

      return { tables, capturedAt: new Date().toISOString() };
    } finally {
      await db.close();
    }
  }

  async executeSelect(sql: string): Promise<QueryResult> {
    validateSelectOnly(sql);
    const db = await this.openDb();
    try {
      const rows = await Promise.race([
        db.all(sql) as Promise<RowData[]>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Query timeout after ${this.timeoutMs}ms`)), this.timeoutMs),
        ),
      ]);

      const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];
      return { columns, rows, rowCount: rows.length };
    } finally {
      await db.close();
    }
  }

  async readNativeComments(): Promise<NativeComment[]> {
    return [];
  }

  async close(): Promise<void> {
    // Connections are opened/closed per-operation
  }
}
