import { encrypt, decrypt } from '@/core/db/encryption';
import type { ConnectionCredentials } from '@/core/types/workspace';

export function encryptCredentials(credentials: ConnectionCredentials): string {
  const plaintext = JSON.stringify(credentials);
  const payload = encrypt(plaintext);
  return JSON.stringify(payload);
}

export function decryptCredentials(encrypted: string): ConnectionCredentials {
  const payload = JSON.parse(encrypted) as Parameters<typeof decrypt>[0];
  const plaintext = decrypt(payload);
  return JSON.parse(plaintext) as ConnectionCredentials;
}

export function redactCredentials(credentials: ConnectionCredentials): Record<string, unknown> {
  if ('connection_string' in credentials) {
    return { connection_string: '[REDACTED]' };
  }
  return {
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: '[REDACTED]',
    password: '[REDACTED]',
  };
}
