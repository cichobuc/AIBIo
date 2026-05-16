import { Database } from 'duckdb-async';
import { getConfig } from '@/core/config';
import { join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

export function getDatamartPath(workspaceId: string): string {
  return resolve(getConfig().workspacesPath, workspaceId, 'datamart.duckdb');
}

export async function withDatamart<T>(
  workspaceId: string,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  const dbPath = getDatamartPath(workspaceId);
  await mkdir(join(dbPath, '..'), { recursive: true });

  const db = await Database.create(dbPath);
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

export async function executeDatamartWrite(workspaceId: string, sql: string): Promise<void> {
  await withDatamart(workspaceId, async (db) => {
    await db.run(sql);
  });
}

export async function executeDatamartRead(
  workspaceId: string,
  sql: string,
  limit = 100,
): Promise<{ columns: string[]; rows: unknown[][]; rowCount: number }> {
  return withDatamart(workspaceId, async (db) => {
    const limitedSql = `SELECT * FROM (${sql}) __preview LIMIT ${limit}`;
    const rows = await db.all(limitedSql) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
    const rowArrays = rows.map((r) => Object.values(r));
    return { columns, rows: rowArrays, rowCount: rows.length };
  });
}
