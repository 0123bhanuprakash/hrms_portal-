import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { mergeUiState, UI_STATE_LIMITS } from './ui-state';

describe('mergeUiState', () => {
  it('adds, replaces and removes keys', () => {
    const a = mergeUiState({}, { 'chart:by-department': 'donut', 'menu:open': ['Time'] });
    expect(a).toEqual({ 'chart:by-department': 'donut', 'menu:open': ['Time'] });
    const b = mergeUiState(a, { 'chart:by-department': 'list', 'menu:open': null });
    expect(b).toEqual({ 'chart:by-department': 'list' });
  });

  it('treats a missing or broken current value as empty', () => {
    expect(mergeUiState(null, { x: 1 })).toEqual({ x: 1 });
    expect(mergeUiState([1, 2], { x: true })).toEqual({ x: true });
  });

  it('rejects bad names, values and sizes', () => {
    expect(() => mergeUiState({}, { 'bad key!': 1 })).toThrow(BadRequestException);
    expect(() => mergeUiState({}, { x: undefined })).toThrow(BadRequestException);
    expect(() => mergeUiState({}, { x: 'a'.repeat(UI_STATE_LIMITS.valueBytes + 1) })).toThrow(BadRequestException);
    expect(() => mergeUiState({}, [1] as unknown)).toThrow(BadRequestException);
    const many = Object.fromEntries(Array.from({ length: UI_STATE_LIMITS.keys + 1 }, (_, i) => [`k${i}`, 1]));
    expect(() => mergeUiState({}, many)).toThrow(BadRequestException);
  });
});
