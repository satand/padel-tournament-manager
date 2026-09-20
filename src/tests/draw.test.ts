import { describe, expect, it } from 'vitest';
import { assignTiers, defaultGroupNames, generateBalancedGroups, tierForLevel } from '@/lib/domain/draw';
import type { Participant } from '@/lib/domain/types';

function team(id: string, level: number): Participant {
  return { id, displayName: id, type: 'TEAM', playerIds: [], level };
}

describe('draw — fasce e gironi bilanciati', () => {
  it('calcola la fascia con soglie fisse decrescenti', () => {
    const thresholds = [5, 4];
    expect(tierForLevel(6, thresholds)).toBe(1);
    expect(tierForLevel(5, thresholds)).toBe(1);
    expect(tierForLevel(4.5, thresholds)).toBe(2);
    expect(tierForLevel(4, thresholds)).toBe(2);
    expect(tierForLevel(3.9, thresholds)).toBe(3);
    expect(tierForLevel(undefined, thresholds)).toBe(3);
    expect(tierForLevel(9, [])).toBe(1);
  });

  it('assegna le fasce a tutti i partecipanti', () => {
    const tiers = assignTiers([team('a', 6), team('b', 4.2), team('c', 2)], [5, 4]);
    expect(tiers.map((t) => t.tier)).toEqual([1, 2, 3]);
  });

  it('distribuisce 8 squadre su 2 gironi in modo bilanciato (serpentina)', () => {
    const participants = [8, 7, 6, 5, 4, 3, 2, 1].map((lvl, i) => team(`p${i + 1}`, lvl));
    const groups = generateBalancedGroups(participants, 2);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(4);
    expect(groups[1]).toHaveLength(4);
    const sum = (g: Participant[]) => g.reduce((acc, p) => acc + (p.level ?? 0), 0);
    expect(sum(groups[0])).toBe(sum(groups[1]));
    expect(groups[0][0].id).toBe('p1');
  });

  it('gestisce un solo girone e numeri dispari senza esplodere', () => {
    const participants = [1, 2, 3, 4, 5].map((lvl, i) => team(`q${i + 1}`, lvl));
    const single = generateBalancedGroups(participants, 1);
    expect(single[0]).toHaveLength(5);
    const three = generateBalancedGroups(participants, 3);
    const total = three.reduce((acc, g) => acc + g.length, 0);
    expect(total).toBe(5);
  });

  it('genera nomi girone A, B, C...', () => {
    expect(defaultGroupNames(3)).toEqual(['Girone A', 'Girone B', 'Girone C']);
  });
});
