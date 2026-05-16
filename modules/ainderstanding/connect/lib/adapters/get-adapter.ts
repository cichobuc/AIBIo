import { db } from '@/core/db/client';
import { dataSources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { createAdapter, type SourceAdapter } from './factory';

export function getAdapterForSource(dataSourceId: string): { adapter: SourceAdapter; name: string } {
  const row = db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).get();
  if (!row) throw new Error(`DATA_SOURCE_NOT_FOUND: ${dataSourceId}`);
  return {
    adapter: createAdapter(
      {
        id: row.id,
        workspaceId: row.workspaceId,
        name: row.name,
        dbType: row.dbType as never,
        connectionMode: row.connectionMode as never,
        connectionSettingsJson: row.connectionSettingsJson
          ? JSON.parse(row.connectionSettingsJson)
          : null,
        status: row.status as never,
        lastTestedAt: row.lastTestedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.connectionCredentialsEncrypted,
    ),
    name: row.name,
  };
}
