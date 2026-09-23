import { describe, expect, it } from 'vitest';
import { bracketLabel, phaseLabel } from '@/lib/domain/labels';

describe('bracketLabel', () => {
  it('mappa i tabelloni Gold/Silver', () => {
    expect(bracketLabel('GOLD')).toBe('Gold');
    expect(bracketLabel('SILVER')).toBe('Silver');
  });

  it('restituisce stringa vuota per tabellone assente', () => {
    expect(bracketLabel(null)).toBe('');
    expect(bracketLabel(undefined)).toBe('');
  });
});

describe('phaseLabel', () => {
  it('etichetta le fasi note', () => {
    expect(phaseLabel('final')).toBe('Finale');
    expect(phaseLabel('group')).toBe('Girone');
  });
});
