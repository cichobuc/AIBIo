import { Database } from 'duckdb-async';
import type { SourceAdapter } from './base';
import type {
  ConnectionTestResult,
  SchemaSnapshot,
  SchemaTable,
  SchemaColumn,
  SchemaView,
  SchemaRoutine,
  SchemaIndex,
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
        `SELECT DISTINCT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('information_schema','pg_catalog')`,
      )) as RowData[];

      const schemaNames = schemasRes.map((r) => r['schema_name'] as string);

      // PK / FK constraints (try/catch for driver version compatibility)
      const pkSet = new Set<string>();
      const fkSet = new Set<string>();
      try {
        const constraintsRes = (await db.all(
          `SELECT constraint_column_names, constraint_type, table_name, schema_name
           FROM duckdb_constraints()
           WHERE constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')`,
        )) as RowData[];
        for (const c of constraintsRes) {
          const schema = c['schema_name'] as string;
          const table = c['table_name'] as string;
          const cols = c['constraint_column_names'] as string[];
          const type = c['constraint_type'] as string;
          for (const col of cols) {
            if (type === 'PRIMARY KEY') pkSet.add(`${schema}.${table}.${col}`);
            else fkSet.add(`${schema}.${table}.${col}`);
          }
        }
      } catch {}

      const tables: SchemaTable[] = [];

      for (const schema_name of schemaNames) {
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
            isPrimaryKey: pkSet.has(`${schema_name}.${table_name}.${c['column_name']}`),
            isForeignKey: fkSet.has(`${schema_name}.${table_name}.${c['column_name']}`),
          }));

          tables.push({ name: table_name, schema: schema_name, columns });
        }
      }

      // Views
      const views: SchemaView[] = [];
      for (const schema_name of schemaNames) {
        try {
          const viewsRes = (await db.all(
            `SELECT table_name, view_definition
             FROM information_schema.views
             WHERE table_schema = ?
             ORDER BY table_name`,
            schema_name,
          )) as RowData[];

          for (const v of viewsRes) {
            const view_name = v['table_name'] as string;
            const colsRes = (await db.all(
              `SELECT column_name, data_type, is_nullable
               FROM information_schema.columns
               WHERE table_schema = ? AND table_name = ?
               ORDER BY ordinal_position`,
              schema_name,
              view_name,
            )) as RowData[];

            views.push({
              name: view_name,
              schema: schema_name,
              definitionPreview: typeof v['view_definition'] === 'string'
                ? (v['view_definition'] as string).slice(0, 200)
                : undefined,
              columns: colsRes.map((c) => ({
                name: c['column_name'] as string,
                dataType: c['data_type'] as string,
                nullable: c['is_nullable'] === 'YES',
                isPrimaryKey: false,
                isForeignKey: false,
              })),
            });
          }
        } catch {}
      }

      // Routines (user-defined functions)
      const routines: SchemaRoutine[] = [];
      try {
        const fnsRes = (await db.all(
          `SELECT function_name, function_type, return_type, schema_name
           FROM duckdb_functions()
           WHERE NOT internal AND schema_name NOT IN ('information_schema','pg_catalog')
           ORDER BY schema_name, function_name`,
        )) as RowData[];

        for (const f of fnsRes) {
          routines.push({
            name: f['function_name'] as string,
            schema: f['schema_name'] as string,
            kind: (f['function_type'] as string) === 'aggregate' ? 'function' : 'function',
            returnType: f['return_type'] as string | undefined,
          });
        }
      } catch {}

      // Indexes
      const indexes: SchemaIndex[] = [];
      try {
        const idxRes = (await db.all(
          `SELECT index_name, schema_name, table_name, is_unique, is_primary,
                  expressions
           FROM duckdb_indexes()
           WHERE schema_name NOT IN ('information_schema','pg_catalog')
           ORDER BY schema_name, table_name, index_name`,
        )) as RowData[];

        for (const i of idxRes) {
          const exprs = i['expressions'] as string | null;
          const columns = exprs
            ? exprs.split(',').map((c) => c.trim().replace(/['"]/g, ''))
            : [];
          indexes.push({
            name: i['index_name'] as string,
            schema: i['schema_name'] as string,
            tableName: i['table_name'] as string,
            columns,
            isUnique: Boolean(i['is_unique']),
            isPrimary: Boolean(i['is_primary']),
          });
        }
      } catch {}

      return { tables, views, routines, indexes, schemas: schemaNames, capturedAt: new Date().toISOString() };
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
