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
      { id: 'm2', participantAId: 'a', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 2 }] },
      { id: 'm3', participantAId: 'b', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 3 }] }
    ];

    const ranking = calculateRanking(participants, matches, defaultTournamentRules);
    expect(ranking[0].participantId).toBe('a');
    expect(ranking[0].points).toBe(6);
    expect(ranking[0].gameDiff).toBe(6);
    expect(ranking[1].participantId).toBe('b');
    expect(ranking[2].participantId).toBe('c');
  });

  it('usa lo scontro diretto tra due partecipanti a pari punti', () => {
    const matches: Match[] = [
      { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }] },
      { id: 'm2', participantAId: 'b', participantBId: 'a', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 5 }] }
    ];

    const ranking = calculateRanking(
      participants.filter((p) => p.id === 'a' || p.id === 'b'),
      matches,
      { ...defaultTournamentRules, tieBreakers: ['points', 'headToHead', 'gameDiff'] }
    );
    expect(ranking.map((row) => row.participantId)).toEqual(['a', 'b']);
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

  it('TIME: classifica solo per vittorie, senza set e game', () => {
    const matches: Match[] = [
      { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [], winnerId: 'a' },
      { id: 'm2', participantAId: 'a', participantBId: 'c', status: 'COMPLETED', sets: [], winnerId: 'a' },
      { id: 'm3', participantAId: 'b', participantBId: 'c', status: 'COMPLETED', sets: [], winnerId: 'b' }
    ];
    const ranking = calculateRanking(participants, matches, { ...defaultTournamentRules, scoringMode: 'TIME' });
    expect(ranking.map((r) => r.participantId)).toEqual(['a', 'b', 'c']);
    expect(ranking[0].points).toBe(6);
    expect(ranking[0].setsWon).toBe(0);
    expect(ranking[0].gameDiff).toBe(0);
  });

  it('GAMES_TARGET: usa il tally in game e ignora i set', () => {
    const matches: Match[] = [
      { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 10, gamesB: 7 }] },
      { id: 'm2', participantAId: 'a', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 10, gamesB: 4 }] },
      { id: 'm3', participantAId: 'b', participantBId: 'c', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 10, gamesB: 9 }] }
    ];
    const ranking = calculateRanking(participants, matches, { ...defaultTournamentRules, scoringMode: 'GAMES_TARGET' });
    expect(ranking.map((r) => r.participantId)).toEqual(['a', 'b', 'c']);
    expect(ranking[0].setsWon).toBe(0);
    expect(ranking[0].gamesWon).toBe(20);
    expect(ranking[0].gameDiff).toBe(9);
  });
});
