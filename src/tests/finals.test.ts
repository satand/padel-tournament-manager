import { describe, expect, it } from 'vitest';
import {
  bracketSizeFor,
  clampGoldCount,
  defaultGoldCount,
  eligibleRounds,
  orderQualifiers,
  splitGoldSilver,
  type ComparableQualified
} from '@/lib/domain/finals';
import { buildFinalBracket } from '@/lib/domain/scheduler';
import { sumMvpRatingByParticipant } from '@/lib/domain/mvp';
import type { MVPVote, Participant } from '@/lib/domain/types';

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
