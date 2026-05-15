import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getConfig } from '@/core/config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type EncryptedPayload = {
  ciphertext: string; // base64
  iv: string;         // base64
  authTag: string;    // base64
};

function getKey(): Buffer {
  const config = getConfig();
  return Buffer.from(config.encryptionKey, 'base64');
}

export function encrypt(plaintext: string): EncryptedPayload {
  const iv = randomBytes(IV_BYTES);
  const key = getKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  if (iv.length !== IV_BYTES) {
    throw new Error('Decryption failed: invalid IV length');
  }
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Decryption failed: invalid auth tag length');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Decryption failed: bad IV, auth tag, or corrupted ciphertext');
  }
}
