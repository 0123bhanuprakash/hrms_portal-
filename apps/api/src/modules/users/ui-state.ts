import { BadRequestException } from '@nestjs/common';

/**
 * Small per-user view settings that follow the person to any device:
 * chart styles ("chart:by-department": "donut"), open menu sections,
 * calendar views, list page sizes… Keys are short dotted names; values
 * are plain JSON and kept small.
 */
export type UiState = Record<string, unknown>;

const KEY = /^[a-z0-9][a-z0-9:._-]{0,79}$/i;
export const UI_STATE_LIMITS = { keys: 200, valueBytes: 2048, totalBytes: 32_768 } as const;

/** Applies `changes` to `current` (null removes a key) and checks the limits. */
export function mergeUiState(current: unknown, changes: unknown): UiState {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new BadRequestException('changes must be an object');
  const next: UiState = current && typeof current === 'object' && !Array.isArray(current) ? { ...(current as UiState) } : {};
  for (const [key, value] of Object.entries(changes as UiState)) {
    if (!KEY.test(key)) throw new BadRequestException(`Invalid setting name: ${key.slice(0, 40)}`);
    if (value === null) {
      delete next[key];
      continue;
    }
    if (!['string', 'number', 'boolean', 'object'].includes(typeof value)) throw new BadRequestException(`Invalid value for ${key}`);
    if (Buffer.byteLength(JSON.stringify(value)) > UI_STATE_LIMITS.valueBytes) throw new BadRequestException(`Value for ${key} is too large`);
    next[key] = value;
  }
  if (Object.keys(next).length > UI_STATE_LIMITS.keys) throw new BadRequestException('Too many saved settings');
  if (Buffer.byteLength(JSON.stringify(next)) > UI_STATE_LIMITS.totalBytes) throw new BadRequestException('Saved settings are too large');
  return next;
}
