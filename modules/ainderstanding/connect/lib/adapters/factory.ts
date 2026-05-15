import type { SourceAdapter } from './base';
import { PostgresAdapter } from './postgres';
import { DuckDbAdapter } from './duckdb';
import type { DataSource, ConnectionSettings } from '@/core/types/workspace';
import { decryptCredentials } from '../credentials-service';

export type { SourceAdapter } from './base';

export function createAdapter(source: DataSource, connectionCredentialsEncrypted: string): SourceAdapter {
  const credentials = decryptCredentials(connectionCredentialsEncrypted);
  const settings: ConnectionSettings = source.connectionSettingsJson ?? {};

  switch (source.dbType) {
    case 'postgres':
      return new PostgresAdapter(credentials, settings);
    case 'duckdb':
      // DuckDB form credentials use file_path; connection_string mode encodes the file path directly
      return new DuckDbAdapter(
        credentials as unknown as { file_path: string },
        settings,
      );
    case 'mssql':
    case 'mysql':
      throw new Error(`Adapter for ${source.dbType} is not yet implemented (Phase C2)`);
    default: {
      const _exhaustive: never = source.dbType;
      throw new Error(`Unknown DB type: ${String(_exhaustive)}`);
    }
  }
}
