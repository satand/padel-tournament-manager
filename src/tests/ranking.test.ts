import { describe, expect, it } from 'vitest';
import { calculateMiniLeague, calculateRanking } from '@/lib/domain/ranking';
import { defaultTournamentRules, type Match, type Participant } from '@/lib/domain/types';

const participants: Participant[] = [
  { id: 'a', displayName: 'A', type: 'TEAM', playerIds: ['a1', 'a2'] },
  { id: 'b', displayName: 'B', type: 'TEAM', playerIds: ['b1', 'b2'] },
  { id: 'c', displayName: 'C', type: 'TEAM', playerIds: ['c1', 'c2'] }
];

describe('ranking engine', () => {
  it('calcola punti, set, game e ordine classifica', () => {
    const matches: Match[] = [
      { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }] },
      { id: 'm2', participantAId: 'a', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 3, gamesB: 6 }] },
      { id: 'm3', participantAId: 'b', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 2 }] }
    ];

    const ranking = calculateRanking(participants, matches, defaultTournamentRules);
    expect(ranking[0].participantId).toBe('a');
    expect(ranking[0].points).toBe(3);
    expect(ranking[0].gameDiff).toBe(1);
    expect(ranking[1].participantId).toBe('b');
    expect(ranking[2].participantId).toBe('c');
  });

  it('usa lo scontro diretto tra due partecipanti a pari punti', () => {
    const matches: Match[] = [
      { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }] },
      { id: 'm2', participantAId: 'a', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 3, gamesB: 6 }] },
      { id: 'm3', participantAId: 'b', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 2 }] }
    ];

    const ranking = calculateRanking(participants, matches, { ...defaultTournamentRules, tieBreakers: ['points', 'headToHead', 'gameDiff'] });
    expect(ranking.map((row) => row.participantId)).toEqual(['a', 'b', 'c']);
  });

  it('calcola classifica avulsa per pari merito multiplo', () => {
    const matches: Match[] = [
      { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }] },
      { id: 'm2', participantAId: 'b', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 1 }] },
      { id: 'm3', participantAId: 'c', participantBId: 'a', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 5 }] }
    ];

    const mini = calculateMiniLeague(['a', 'b', 'c'], matches, defaultTournamentRules, participants);
    expect(mini[0].participantId).toBe('b');
    expect(mini[0].gameDiff).toBe(3);
  });
});
