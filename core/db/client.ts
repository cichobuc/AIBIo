import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { getConfig } from '@/core/config';

function createClient() {
  const config = getConfig();
  const sqlite = new Database(config.dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  return { sqlite, db };
}

declare global {
  // eslint-disable-next-line no-var
  var __aibio_db: ReturnType<typeof createClient> | undefined;
}

if (!global.__aibio_db) {
  global.__aibio_db = createClient();
}

export const { sqlite, db } = global.__aibio_db;

export function runMigrations(): void {
  migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'core/db/migrations'),
  });
}
