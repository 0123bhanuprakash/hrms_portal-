import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ============================================================
// Application-level encryption for personal identifiers
// (PAN, bank account numbers). AES-256-GCM with PII_ENCRYPTION_KEY.
//
// Stored format: v1.<iv>.<auth tag>.<ciphertext>  (base64 parts)
// The version prefix leaves room for key rotation later.
// ============================================================

const VERSION = 'v1';

@Injectable()
export class PiiCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.getOrThrow<string>('PII_ENCRYPTION_KEY'), 'base64');
    if (this.key.length !== 32) throw new Error('PII_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, ciphertext] = stored.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Unrecognised encrypted value');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }
}

/** "ABCDE1234F" → "••••••234F" */
export function maskTail(value: string | null | undefined, visible = 4): string | null {
  if (!value) return null;
  return '•'.repeat(Math.max(0, value.length - visible)) + value.slice(-visible);
}
