import { randomUUID } from 'node:crypto';
import { db } from '@/core/db/client';
import { dataSources } from '@/core/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  DataSource,
  DbDriver,
  ConnectionMode,
  ConnectionCredentials,
  ConnectionSettings,
  ConnectionTestResult,
} from '@/core/types/workspace';
import { encryptCredentials } from './credentials-service';
import { createAdapter } from './adapters/factory';

type AddSourceInput = {
  workspaceId: string;
  name: string;
  dbType: DbDriver;
  connectionMode: ConnectionMode;
  credentials: ConnectionCredentials;
  settings?: ConnectionSettings;
};

type UpdateSourceInput = {
  name?: string;
  credentials?: ConnectionCredentials;
  settings?: ConnectionSettings;
};

type RawRow = typeof dataSources.$inferSelect;

function rowToDataSource(row: RawRow): DataSource {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    dbType: row.dbType as DbDriver,
    connectionMode: row.connectionMode as ConnectionMode,
    connectionSettingsJson: row.connectionSettingsJson
      ? (JSON.parse(row.connectionSettingsJson) as ConnectionSettings)
      : null,
    status: row.status as DataSource['status'],
    lastTestedAt: row.lastTestedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function addSource(input: AddSourceInput): DataSource {
  const id = randomUUID();
  const encrypted = encryptCredentials(input.credentials);

  db.insert(dataSources)
    .values({
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      dbType: input.dbType,
      connectionMode: input.connectionMode,
      connectionCredentialsEncrypted: encrypted,
      connectionSettingsJson: input.settings ? JSON.stringify(input.settings) : null,
      status: 'pending',
    })
    .run();

  return getSource(id);
}

export function updateSource(id: string, workspaceId: string, input: UpdateSourceInput): DataSource {
  const existing = db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.id, id), eq(dataSources.workspaceId, workspaceId)))
    .get();

  if (!existing) throw new Error(`Data source not found: ${id}`);

  const updates: Partial<RawRow> = { updatedAt: new Date().toISOString() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.credentials !== undefined) {
    updates.connectionCredentialsEncrypted = encryptCredentials(input.credentials);
  }
  if (input.settings !== undefined) {
    updates.connectionSettingsJson = JSON.stringify(input.settings);
  }

  db.update(dataSources)
    .set(updates)
    .where(and(eq(dataSources.id, id), eq(dataSources.workspaceId, workspaceId)))
    .run();

  return getSource(id);
}

export function removeSource(id: string, workspaceId: string): void {
  db.delete(dataSources)
    .where(and(eq(dataSources.id, id), eq(dataSources.workspaceId, workspaceId)))
    .run();
}

export function listSources(workspaceId: string): DataSource[] {
  return db
    .select()
    .from(dataSources)
    .where(eq(dataSources.workspaceId, workspaceId))
    .all()
    .map(rowToDataSource);
}

export function getSource(id: string): DataSource {
  const row = db.select().from(dataSources).where(eq(dataSources.id, id)).get();
  if (!row) throw new Error(`Data source not found: ${id}`);
  return rowToDataSource(row);
}

export async function testExistingSource(id: string, workspaceId: string): Promise<ConnectionTestResult> {
  const row = db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.id, id), eq(dataSources.workspaceId, workspaceId)))
    .get();

  if (!row) {
    return { success: false, step: 'resolve', error: 'SOURCE_NOT_FOUND', detail: `Source ${id} not found` };
  }

  const adapter = createAdapter(rowToDataSource(row), row.connectionCredentialsEncrypted);
  const result = await adapter.testConnection();
  await adapter.close();

  db.update(dataSources)
    .set({
      status: result.success ? 'active' : 'error',
      lastTestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(dataSources.id, id))
    .run();

  return result;
}

export async function testSourceConfig(
  dbType: DbDriver,
  connectionMode: ConnectionMode,
  credentials: ConnectionCredentials,
  settings: ConnectionSettings,
): Promise<ConnectionTestResult> {
  const encrypted = encryptCredentials(credentials);

  const tempSource: DataSource = {
    id: 'temp',
    workspaceId: 'temp',
    name: 'temp',
    dbType,
    connectionMode,
    connectionSettingsJson: settings,
    status: 'pending',
    lastTestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const adapter = createAdapter(tempSource, encrypted);
  const result = await adapter.testConnection();
  await adapter.close();
  return result;
}
