import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// ============================================================
// Email job field encryption
//
// Queued email jobs live in Redis (and are visible in Bull Board) until
// they are cleaned up. Fields that grant account access — temporary
// passwords and reset / verification links — are encrypted with
// AES-256-GCM before enqueueing and decrypted only inside the worker.
//
// The key is derived from JWT_SECRET, so no extra env var is needed.
// ============================================================

const SENSITIVE_FIELDS = ['temporaryPassword', 'resetLink', 'verifyLink'] as const;
const PREFIX = 'enc:v1:';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`${secret}:email-jobs`).digest();
}

function encrypt(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decrypt(value: string, key: Buffer): string {
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** Returns a copy of `data` with sensitive string fields encrypted. */
export function sealJobData<T extends object>(data: T, secret: string): T {
  const key = deriveKey(secret);
  const copy = { ...data } as Record<string, unknown>;
  for (const field of SENSITIVE_FIELDS) {
    const value = copy[field];
    if (typeof value === 'string') copy[field] = encrypt(value, key);
  }
  return copy as T;
}

/** Reverses sealJobData. Plain (legacy) values are passed through unchanged. */
export function openJobData<T extends object>(data: T, secret: string): T {
  const key = deriveKey(secret);
  const copy = { ...data } as Record<string, unknown>;
  for (const field of SENSITIVE_FIELDS) {
    const value = copy[field];
    if (typeof value === 'string' && value.startsWith(PREFIX)) copy[field] = decrypt(value, key);
  }
  return copy as T;
}
