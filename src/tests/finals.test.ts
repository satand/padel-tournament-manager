import { describe, expect, it } from 'vitest';
import {
  bracketPhaseReached,
  bracketPlacements,
  bracketSizeFor,
  clampGoldCount,
  defaultGoldCount,
  generalPhaseReached,
  eligibleRounds,
  orderQualifiers,
  splitGoldSilver,
  type ComparableQualified
} from '@/lib/domain/finals';
import { buildFinalBracket } from '@/lib/domain/scheduler';
import { sumMvpRatingByParticipant } from '@/lib/domain/mvp';
import type { Match, MVPVote, Participant } from '@/lib/domain/types';

const q = (id: string, points: number, gameDiff: number, mvpSum = 0): ComparableQualified =>
  ({ id, displayName: id, points, gameDiff, mvpSum });

describe('finals — ordine qualificati cross-girone', () => {
  it('ordina per punti, poi diff game, poi somma MVP, poi nome', () => {
    const ordered = orderQualifiers([
      q('D', 6, 2, 5),
      q('A', 6, 2, 8),
      q('B', 6, 5, 1),
      q('C', 9, -3, 0)
    ]).map((r) => r.id);
    expect(ordered).toEqual(['C', 'B', 'A', 'D']);
  });

  it('a parita di punti/game/mvp decide il nome', () => {
    const ordered = orderQualifiers([q('Zeta', 3, 0, 0), q('Alfa', 3, 0, 0)]).map((r) => r.id);
    expect(ordered).toEqual(['Alfa', 'Zeta']);
  });
});

describe('finals — dimensionamento tabellone', () => {
  it('bracketSizeFor arrotonda al power-of-two minimo che contiene gli iscritti', () => {
    expect(bracketSizeFor(6)).toBe(8);
    expect(bracketSizeFor(8)).toBe(8);
    expect(bracketSizeFor(1)).toBe(2);
  });

  it('bracketSizeFor rispetta il giro scelto se capiente, altrimenti cresce', () => {
    expect(bracketSizeFor(6, 'QF')).toBe(8);
    expect(bracketSizeFor(3, 'SF')).toBe(4);
    expect(bracketSizeFor(6, 'SF')).toBe(8); // SF=4 non basta per 6 -> cresce
    expect(bracketSizeFor(4, 'R16')).toBe(32); // giro piu grande -> BYE
  });

  it('eligibleRounds offre solo i giri in grado di contenere gli iscritti', () => {
    expect(eligibleRounds(6)).toEqual(['QF', 'R8', 'R16']);
    expect(eligibleRounds(2)).toEqual(['FINAL', 'SF', 'QF', 'R8', 'R16']);
  });
});

describe('finals — split Gold/Silver', () => {
  it('defaultGoldCount e clamp garantiscono almeno 2 squadre per parte', () => {
    expect(defaultGoldCount(6)).toBe(3);
    expect(defaultGoldCount(8)).toBe(4);
    expect(defaultGoldCount(4)).toBe(2);
    expect(defaultGoldCount(3)).toBe(3);
    expect(clampGoldCount(6, 10)).toBe(4);
    expect(clampGoldCount(6, 1)).toBe(2);
  });

  it('splitGoldSilver prende le migliori G in Gold, il resto in Silver', () => {
    const ordered = [q('A', 9, 0), q('B', 8, 0), q('C', 7, 0), q('D', 6, 0), q('E', 5, 0), q('F', 4, 0)];
    const { gold, silver } = splitGoldSilver(ordered, 4);
    expect(gold.map((r) => r.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(silver.map((r) => r.id)).toEqual(['E', 'F']);
  });

  it('con meno di 4 qualificate non divide (tutto in Gold)', () => {
    const { gold, silver } = splitGoldSilver([q('A', 9, 0), q('B', 8, 0), q('C', 7, 0)], 1);
    expect(gold.length).toBe(3);
    expect(silver.length).toBe(0);
  });
});

describe('finals — BYE alle migliori teste di serie', () => {
  const participants = (n: number): Participant[] =>
    Array.from({ length: n }, (_, i) => ({ id: `P${i + 1}`, displayName: `P${i + 1}`, type: 'TEAM' as const, playerIds: [] }));

  it('con 3 iscritte su tabellone da 4, la migliore riceve il BYE', () => {
    const bracket = buildFinalBracket(participants(3), null, 4);
    const walkover = bracket.filter((m) => m.status === 'WALKOVER');
    expect(walkover.length).toBe(1);
    expect(walkover[0].winnerId).toBe('P1');
    const played = bracket.find((m) => m.status === 'SCHEDULED');
    expect([played?.a, played?.b]).toEqual([
      { kind: 'participant', participantId: 'P2' },
      { kind: 'participant', participantId: 'P3' }
    ]);
  });

  it('con 6 iscritte su tabellone da 8, le migliori due ricevono il BYE', () => {
    const winners = buildFinalBracket(participants(6), 'GOLD', 8)
      .filter((m) => m.status === 'WALKOVER')
      .map((m) => m.winnerId)
      .sort();
    expect(winners).toEqual(['P1', 'P2']);
  });
});

describe('mvp — somma media voto per squadra', () => {
  const vote = (playerId: string, rating: number): MVPVote =>
    ({ id: `${playerId}-${rating}`, matchId: 'm1', playerId, rating, weight: 1, source: 'organizer' });
  const participants: Participant[] = [
    { id: 'T1', displayName: 'T1', type: 'TEAM', playerIds: ['a', 'b'] },
    { id: 'T2', displayName: 'T2', type: 'TEAM', playerIds: ['c', 'd'] }
  ];

  it('somma le medie dei due giocatori (non la media complessiva)', () => {
    const votes = [vote('a', 8), vote('a', 6), vote('b', 7), vote('c', 5), vote('d', 5)];
    const sums = sumMvpRatingByParticipant(participants, votes);
    expect(sums['T1']).toBe(14); // (8+6)/2=7 + (7)/1=7
    expect(sums['T2']).toBe(10); // 5 + 5
  });

  it('vale 0 per chi non ha voti', () => {
    const sums = sumMvpRatingByParticipant(participants, [vote('a', 7)]);
    expect(sums['T2']).toBe(0);
  });
});

describe('finals — classifica a piazzamento per tabellone', () => {
  const pt = (id: string): Participant => ({ id, displayName: id, type: 'TEAM', playerIds: [] });
  const mt = (m: Partial<Match> & { id: string }): Match =>
    ({ participantAId: null, participantBId: null, status: 'SCHEDULED', sets: [], ...m });
  const view = (p: ReturnType<typeof bracketPlacements>[number]) =>
    p.placements.map((x) => `${x.position}:${x.displayName}:${x.phaseLabel}`);

  it('nessun tabellone se non ci sono partite di fase finale', () => {
    const ms = [mt({ id: 'g', phase: 'group', groupId: 'G1', participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' })];
    expect(bracketPlacements([pt('A'), pt('B')], ms)).toEqual([]);
  });

  it('tabellone unico: Campione primo, poi fase raggiunta, pari-merito a pari round', () => {
    const ms = [
      mt({ id: 'sf1', phase: 'semifinal', roundIndex: 1, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' }),
      mt({ id: 'sf2', phase: 'semifinal', roundIndex: 1, participantAId: 'C', participantBId: 'D', status: 'COMPLETED', winnerId: 'C' }),
      mt({ id: 'f', phase: 'final', roundIndex: 2, participantAId: 'A', participantBId: 'C', status: 'COMPLETED', winnerId: 'A' })
    ];
    const [t] = bracketPlacements([pt('A'), pt('B'), pt('C'), pt('D')], ms);
    expect(t.bracket).toBeNull();
    expect(view(t)).toEqual(['1:A:Campione', '2:C:Finalista', '3:B:Semifinalista', '3:D:Semifinalista']);
    const rows = Object.fromEntries(t.placements.map((p) => [p.displayName, p]));
    expect(rows.A.wins).toBe(2); expect(rows.A.losses).toBe(0);
    expect(rows.C.wins).toBe(1); expect(rows.C.losses).toBe(1);
    expect(rows.B.wins).toBe(0); expect(rows.B.losses).toBe(1);
  });

  it('separa tabelloni Gold e Silver con campioni indipendenti', () => {
    const ms = [
      mt({ id: 'gf', bracket: 'GOLD', phase: 'final', roundIndex: 2, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' }),
      mt({ id: 'sf', bracket: 'SILVER', phase: 'final', roundIndex: 2, participantAId: 'C', participantBId: 'D', status: 'COMPLETED', winnerId: 'D' })
    ];
    const tables = bracketPlacements([pt('A'), pt('B'), pt('C'), pt('D')], ms);
    expect(tables.map((t) => t.bracket)).toEqual(['GOLD', 'SILVER']);
    expect(view(tables[0])[0]).toBe('1:A:Campione');
    expect(view(tables[1])[0]).toBe('1:D:Campione');
  });

  it('ignora le partite di girone', () => {
    const ms = [
      mt({ id: 'g', phase: 'group', groupId: 'G1', participantAId: 'X', participantBId: 'Y', status: 'COMPLETED', winnerId: 'X' }),
      mt({ id: 'f', phase: 'final', roundIndex: 1, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' })
    ];
    const [t] = bracketPlacements([pt('A'), pt('B'), pt('X'), pt('Y')], ms);
    expect(t.placements.map((p) => p.displayName).sort()).toEqual(['A', 'B']);
  });

  it('BYE/WALKOVER a tavolino non generano V ne P', () => {
    const ms = [
      mt({ id: 'r1a', phase: 'quarterfinal', roundIndex: 1, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' }),
      mt({ id: 'r1b', phase: 'quarterfinal', roundIndex: 1, participantAId: 'C', participantBId: null, status: 'WALKOVER', winnerId: 'C' }),
      mt({ id: 'f', phase: 'final', roundIndex: 2, participantAId: 'A', participantBId: 'C', status: 'COMPLETED', winnerId: 'A' })
    ];
    const [t] = bracketPlacements([pt('A'), pt('B'), pt('C')], ms);
    const rows = Object.fromEntries(t.placements.map((p) => [p.displayName, p]));
    expect(rows.C.wins).toBe(0); expect(rows.C.losses).toBe(1);
    expect(rows.A.wins).toBe(2);
  });

  it('con finale da giocare i finalisti sono pari in testa senza Campione', () => {
    const ms = [
      mt({ id: 'sf1', phase: 'semifinal', roundIndex: 1, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' }),
      mt({ id: 'sf2', phase: 'semifinal', roundIndex: 1, participantAId: 'C', participantBId: 'D', status: 'COMPLETED', winnerId: 'C' }),
      mt({ id: 'f', phase: 'final', roundIndex: 2, participantAId: 'A', participantBId: 'C', status: 'SCHEDULED' })
    ];
    const [t] = bracketPlacements([pt('A'), pt('B'), pt('C'), pt('D')], ms);
    expect(view(t)).toEqual(['1:A:Finalista', '1:C:Finalista', '3:B:Semifinalista', '3:D:Semifinalista']);
  });
});

describe('finals — mappe "Fase raggiunta"', () => {
  const pt = (id: string): Participant => ({ id, displayName: id, type: 'TEAM', playerIds: [] });
  const mt = (m: Partial<Match> & { id: string }): Match =>
    ({ participantAId: null, participantBId: null, status: 'SCHEDULED', sets: [], ...m });
  const all = [pt('A'), pt('B'), pt('C'), pt('D'), pt('Z')];

  it('tabellone unico: etichette senza prefisso, esclusi = baseLabel', () => {
    const ms = [
      mt({ id: 'sf1', phase: 'semifinal', roundIndex: 1, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' }),
      mt({ id: 'sf2', phase: 'semifinal', roundIndex: 1, participantAId: 'C', participantBId: 'D', status: 'COMPLETED', winnerId: 'C' }),
      mt({ id: 'f', phase: 'final', roundIndex: 2, participantAId: 'A', participantBId: 'C', status: 'COMPLETED', winnerId: 'A' })
    ];
    const map = generalPhaseReached(all, ms, 'Gironi');
    expect(map.get('A')).toBe('Campione');
    expect(map.get('C')).toBe('Finalista');
    expect(map.get('B')).toBe('Semifinalista');
    expect(map.get('Z')).toBe('Gironi');
  });

  it('split Gold/Silver: prefisso tabellone, argento campione = Vincitore', () => {
    const ms = [
      mt({ id: 'gf', bracket: 'GOLD', phase: 'final', roundIndex: 1, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' }),
      mt({ id: 'sf', bracket: 'SILVER', phase: 'final', roundIndex: 1, participantAId: 'C', participantBId: 'D', status: 'COMPLETED', winnerId: 'D' })
    ];
    const map = generalPhaseReached(all, ms, 'Gironi');
    expect(map.get('A')).toBe('Campione (Gold)');
    expect(map.get('B')).toBe('Finalista (Gold)');
    expect(map.get('D')).toBe('Vincitore (Silver)');
    expect(map.get('C')).toBe('Finalista (Silver)');
    expect(map.get('Z')).toBe('Gironi');
  });

  it('bracketPhaseReached mappa pid -> etichetta del singolo tabellone', () => {
    const ms = [mt({ id: 'f', phase: 'final', roundIndex: 1, participantAId: 'A', participantBId: 'B', status: 'COMPLETED', winnerId: 'A' })];
    const [t] = bracketPlacements(all, ms);
    const map = bracketPhaseReached(t);
    expect(map.get('A')).toBe('Campione');
    expect(map.get('B')).toBe('Finalista');
    expect(map.get('Z')).toBeUndefined();
  });
});
