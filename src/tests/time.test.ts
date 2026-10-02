import { describe, expect, it } from 'vitest';
import { formatDay, formatTime, isValidTimezone } from '@/lib/domain/time';

describe('time — fuso e DST', () => {
  it('estate: Europe/Rome e\' UTC+2', () => {
    expect(formatTime('2026-09-21T07:30:00.000Z', 'Europe/Rome')).toBe('09:30');
  });

  it('inverno: Europe/Rome e\' UTC+1', () => {
    expect(formatTime('2026-12-21T08:30:00.000Z', 'Europe/Rome')).toBe('09:30');
  });

  it('il giorno dipende dal fuso (late UTC = giorno dopo a Roma)', () => {
    expect(formatDay('2026-09-21T22:30:00.000Z', 'Europe/Rome')).toBe('22/09/2026');
    expect(formatDay('2026-09-21T22:30:00.000Z', 'UTC')).toBe('21/09/2026');
  });

  it('default Roma quando il fuso e\' vuoto o non valido', () => {
    expect(formatTime('2026-09-21T07:30:00.000Z', 'Bad/Zone')).toBe('09:30');
    expect(formatTime('2026-09-21T07:30:00.000Z')).toBe('09:30');
  });

  it('isValidTimezone', () => {
    expect(isValidTimezone('Europe/Rome')).toBe(true);
    expect(isValidTimezone('Not/AZone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});
