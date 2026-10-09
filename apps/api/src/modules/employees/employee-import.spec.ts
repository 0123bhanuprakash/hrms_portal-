import { describe, expect, it } from 'vitest';
import { parseExperience } from './employee-import.service';

describe('import: experience before joining', () => {
  it.each([
    ['4', 48],
    ['4.5', 54],
    ['3 years', 36],
    ['2y 6m', 30],
    ['2 yrs, 3 months', 27],
    ['18 months', 18],
    ['0', 0],
  ])('%s → %i months', (text, months) => {
    expect(parseExperience(text)).toBe(months);
  });

  it('blank, nonsense and over 50 years give nothing', () => {
    expect(parseExperience('')).toBeNull();
    expect(parseExperience('lots')).toBeNull();
    expect(parseExperience('51')).toBeNull();
  });
});
