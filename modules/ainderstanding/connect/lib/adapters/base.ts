import type {
  ConnectionTestResult,
  SchemaSnapshot,
  NativeComment,
  QueryResult,
} from '@/core/types/workspace';

export interface SourceAdapter {
  testConnection(): Promise<ConnectionTestResult>;
  introspectSchema(): Promise<SchemaSnapshot>;
  executeSelect(sql: string): Promise<QueryResult>;
  readNativeComments(): Promise<NativeComment[]>;
  close(): Promise<void>;
}
