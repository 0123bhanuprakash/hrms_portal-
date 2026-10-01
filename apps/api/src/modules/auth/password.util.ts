import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export const BCRYPT_ROUNDS = 12;

/**
 * Random temporary password emailed to newly provisioned users.
 * 16 hex chars + suffix so it satisfies upper/lower/digit/symbol rules.
 */
export function generateTemporaryPassword(): string {
  return `${crypto.randomBytes(8).toString('hex')}A1!`;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
