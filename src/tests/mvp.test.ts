import { describe, expect, it } from 'vitest';
import { calculateMVPStandings } from '@/lib/domain/mvp';
import { defaultMVPSettings, type Match, type MVPVote, type Participant, type Player } from '@/lib/domain/types';

const players: Player[] = [
  { id: 'p1', firstName: 'A', lastName: 'One', displayName: 'A One' },
  { id: 'p2', firstName: 'B', lastName: 'Two', displayName: 'B Two' }
];
const participants: Participant[] = [
  { id: 't1', displayName: 'Team 1', type: 'TEAM', playerIds: ['p1'] },
  { id: 't2', displayName: 'Team 2', type: 'TEAM', playerIds: ['p2'] }
];
const matches: Match[] = [
  { id: 'm1', participantAId: 't1', participantBId: 't2', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }], phase: 'group' },
  { id: 'm2', participantAId: 't1', participantBId: 't2', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 7, gamesB: 6 }], phase: 'final' }
];

describe('mvp engine', () => {
  it('calcola miglior giocatore con voti, MVP e bonus finale', () => {
    const votes: MVPVote[] = [
      { id: 'v1', matchId: 'm1', playerId: 'p1', rating: 8, weight: 1, source: 'organizer', electedMvp: true },
      { id: 'v2', matchId: 'm2', playerId: 'p1', rating: 9, weight: 1, source: 'organizer', electedMvp: true },
      { id: 'v3', matchId: 'm2', playerId: 'p2', rating: 9.5, weight: 1, source: 'organizer', electedMvp: false }
    ];
    const standings = calculateMVPStandings(players, participants, matches, votes, defaultMVPSettings);
    expect(standings[0].playerId).toBe('p1');
    expect(standings[0].mvpCount).toBe(2);
    expect(standings[0].finalBonus).toBe(3);
  });
});
