#!/usr/bin/env tsx
/**
 * Seed script — downloads Chinook dataset as DuckDB file and creates a 'demo' workspace.
 *
 * Run: npm run seed
 */
import './load-env'; // must be first — loads .env.local before DB client initializes
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { runMigrations } from '@/core/db/client';
import { db } from '@/core/db/client';
import { workspaces, dataSources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { encryptCredentials } from '@/modules/ainderstanding/connect/lib/credentials-service';

const WORKSPACE_ID = 'demo';
const DATASOURCE_ID = 'chinook-demo';
const WORKSPACES_DIR = process.env.AIBIO_WORKSPACES_PATH ?? './workspaces';
const CHINOOK_DIR = path.join(WORKSPACES_DIR, WORKSPACE_ID);
const CHINOOK_PATH = path.join(CHINOOK_DIR, 'chinook.duckdb');

// Chinook SQLite export — public domain dataset
const CHINOOK_SQLITE_URL =
  'https://github.com/lerocha/chinook-database/releases/download/v1.4.5/Chinook_Sqlite.sqlite';

async function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) =>
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          follow(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const out = createWriteStream(dest);
        pipeline(res, out).then(resolve).catch(reject);
      }).on('error', reject);
    follow(url);
  });
}

async function main() {
  console.log('Running DB migrations...');
  runMigrations();

  mkdirSync(CHINOOK_DIR, { recursive: true });

  if (!existsSync(CHINOOK_PATH)) {
    console.log('Downloading Chinook SQLite...');
    const tmpSqlite = path.join(CHINOOK_DIR, 'chinook.sqlite');
    await download(CHINOOK_SQLITE_URL, tmpSqlite);

    console.log('Converting SQLite → DuckDB...');
    const { Database } = await import('duckdb-async');
    const duck = await Database.create(CHINOOK_PATH);
    const conn = await duck.connect();
    await conn.run(`INSTALL sqlite; LOAD sqlite;`);
    await conn.run(`ATTACH '${tmpSqlite}' AS src (TYPE SQLITE, READ_ONLY TRUE);`);
    const tables = await conn.all(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_catalog = 'src' AND table_type = 'BASE TABLE'`,
    );
    for (const { name } of tables as { name: string }[]) {
      await conn.run(`CREATE TABLE IF NOT EXISTS "${name}" AS SELECT * FROM src.main."${name}";`);
    }
    await conn.close();
    await duck.close();
    const { unlinkSync } = await import('node:fs');
    unlinkSync(tmpSqlite);
    console.log(`DuckDB file created at ${CHINOOK_PATH}`);
  } else {
    console.log(`DuckDB file already exists at ${CHINOOK_PATH}, skipping download.`);
  }

  const now = new Date().toISOString();

  const existingWs = db.select().from(workspaces).where(eq(workspaces.id, WORKSPACE_ID)).get();
  if (!existingWs) {
    db.insert(workspaces).values({
      id: WORKSPACE_ID,
      name: 'Chinook Demo',
      description: 'Chinook music store demo — 11 tables, ~4 000 rows',
      aiMode: 'auto',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }).run();
    console.log(`Workspace '${WORKSPACE_ID}' created.`);
  } else {
    console.log(`Workspace '${WORKSPACE_ID}' already exists, skipping.`);
  }

  const existingDs = db.select().from(dataSources).where(eq(dataSources.id, DATASOURCE_ID)).get();
  if (!existingDs) {
    // DuckDB uses { file_path } which is not in the ConnectionCredentials union — cast for seed only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credentials = encryptCredentials({ file_path: path.resolve(CHINOOK_PATH) } as any);
    db.insert(dataSources).values({
      id: DATASOURCE_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Chinook',
      dbType: 'duckdb',
      connectionMode: 'form',
      connectionCredentialsEncrypted: credentials,
      connectionSettingsJson: null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }).run();
    console.log(`Data source 'Chinook' created (id: ${DATASOURCE_ID}).`);
  } else {
    console.log(`Data source '${DATASOURCE_ID}' already exists, skipping.`);
  }

  console.log('\nDone! Start the app with: npm run dev');
  console.log(`Open: http://localhost:3000/workspace/${WORKSPACE_ID}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
