import { describe, it, expect } from 'vitest';
import {
  resolvePattern,
  sanitizeSegment,
  usedProjectTokens,
  dateValues,
} from '@shared/template';

const D = new Date(2026, 5, 5, 14, 37); // 2026-06-05 14:37 (month is 0-based)

describe('dateValues', () => {
  it('pads and formats correctly', () => {
    const v = dateValues(D);
    expect(v.YYYY).toBe('2026');
    expect(v.YY).toBe('26');
    expect(v.MM).toBe('06');
    expect(v.DD).toBe('05');
    expect(v.HH).toBe('14');
    expect(v.mm).toBe('37');
    expect(v.date).toBe('2026-06-05');
  });
});

describe('resolvePattern', () => {
  it('substitutes date + project tokens', () => {
    const out = resolvePattern('{kunde}/{date}_{projekt}', { kunde: 'ACME', projekt: 'Talk' }, D);
    expect(out).toBe('ACME/2026-06-05_Talk');
  });

  it('keeps dashes and underscores inside segments', () => {
    const out = resolvePattern('Drehtag-{shootday}', { shootday: '1' }, D);
    expect(out).toBe('Drehtag-1');
  });

  it('collapses empty field segments instead of leaving stray separators', () => {
    const out = resolvePattern('{kunde}/{date}', { kunde: '' }, D);
    expect(out).toBe('2026-06-05');
  });

  it('strips path-illegal characters', () => {
    const out = resolvePattern('{projekt}', { projekt: 'a/b:c*?d' }, D);
    expect(out).toBe('abcd');
  });

  it('drops unknown tokens', () => {
    const out = resolvePattern('{unknown}_{date}', {}, D);
    expect(out).toBe('2026-06-05');
  });
});

describe('sanitizeSegment', () => {
  it('trims leading/trailing dots and spaces', () => {
    expect(sanitizeSegment('  ..name..  ')).toBe('name');
  });
});

describe('usedProjectTokens', () => {
  it('returns only referenced project tokens', () => {
    const used = usedProjectTokens('{kunde}/{date}_{projekt}').map((t) => t.key);
    expect(used).toEqual(['projekt', 'kunde']);
  });
});
