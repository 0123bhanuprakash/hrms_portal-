import { describe, expect, it } from 'vitest';
import { BACKDROP_LEVELS as SHARED_LEVELS, BACKDROP_PACKS as SHARED_PACKS, BUILTIN_THEME_KEYS as SHARED_KEYS, MENU_STYLES as SHARED_STYLES } from '@hrms/types';
import { BACKDROP_LEVELS, BACKDROP_PACKS, BUILTIN_THEME_KEYS, MENU_STYLES } from './personalization';

describe('personalisation lists', () => {
  it('match the shared definitions in @hrms/types', () => {
    expect([...BUILTIN_THEME_KEYS]).toEqual([...SHARED_KEYS]);
    expect([...MENU_STYLES]).toEqual([...SHARED_STYLES]);
    expect([...BACKDROP_PACKS]).toEqual([...SHARED_PACKS]);
    expect([...BACKDROP_LEVELS]).toEqual([...SHARED_LEVELS]);
  });

  it('have no duplicates and start with the default menu style', () => {
    expect(new Set(BUILTIN_THEME_KEYS).size).toBe(BUILTIN_THEME_KEYS.length);
    expect(MENU_STYLES[0]).toBe('classic');
  });
});
