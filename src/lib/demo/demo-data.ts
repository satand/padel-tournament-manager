import { defaultMVPSettings, defaultTournamentRules, type Match, type MVPVote, type Participant, type Player } from '../domain/types';

export const demoPlayers: Player[] = [
  { id: 'p1', firstName: 'Marco', lastName: 'Rossi', displayName: 'Marco Rossi' },
  { id: 'p2', firstName: 'Luca', lastName: 'Bianchi', displayName: 'Luca Bianchi' },
  { id: 'p3', firstName: 'Davide', lastName: 'Ferrari', displayName: 'Davide Ferrari' },
  { id: 'p4', firstName: 'Andrea', lastName: 'Gallo', displayName: 'Andrea Gallo' },
  { id: 'p5', firstName: 'Paolo', lastName: 'Neri', displayName: 'Paolo Neri' },
  { id: 'p6', firstName: 'Enrico', lastName: 'Conti', displayName: 'Enrico Conti' },
  { id: 'p7', firstName: 'Fabio', lastName: 'Villa', displayName: 'Fabio Villa' },
  { id: 'p8', firstName: 'Stefano', lastName: 'Costa', displayName: 'Stefano Costa' }
];

export const demoGroups: { id: string; name: string }[] = [{ id: 'gA', name: 'Girone A' }];

export const demoParticipants: Participant[] = [
  { id: 't1', displayName: 'Rossi / Bianchi', type: 'TEAM', playerIds: ['p1', 'p2'], level: 6.2, seed: 1, manualOrder: 1, groupId: 'gA' },
  { id: 't2', displayName: 'Ferrari / Gallo', type: 'TEAM', playerIds: ['p3', 'p4'], level: 5.4, seed: 2, manualOrder: 2, groupId: 'gA' },
  { id: 't3', displayName: 'Neri / Conti', type: 'TEAM', playerIds: ['p5', 'p6'], level: 4.3, seed: 3, manualOrder: 3, groupId: 'gA' },
  { id: 't4', displayName: 'Villa / Costa', type: 'TEAM', playerIds: ['p7', 'p8'], level: 3.6, seed: 4, manualOrder: 4, groupId: 'gA' }
];

export const demoMatches: Match[] = [
  { id: 'm1', participantAId: 't1', participantBId: 't2', status: 'COMPLETED', phase: 'group', groupId: 'gA', roundIndex: 1, courtId: 'court-1', scheduledAt: '2026-07-04T09:00:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }], winnerId: 't1' },
  { id: 'm2', participantAId: 't3', participantBId: 't4', status: 'COMPLETED', phase: 'group', groupId: 'gA', roundIndex: 1, courtId: 'court-2', scheduledAt: '2026-07-04T09:00:00.000Z', sets: [{ setNumber: 1, gamesA: 7, gamesB: 6, tieBreakA: 7, tieBreakB: 5 }], winnerId: 't3' },
  { id: 'm3', participantAId: 't1', participantBId: 't3', status: 'COMPLETED', phase: 'group', groupId: 'gA', roundIndex: 2, courtId: 'court-1', scheduledAt: '2026-07-04T09:40:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 2 }], winnerId: 't1' },
  { id: 'm4', participantAId: 't2', participantBId: 't4', status: 'COMPLETED', phase: 'group', groupId: 'gA', roundIndex: 2, courtId: 'court-2', scheduledAt: '2026-07-04T09:40:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 3 }], winnerId: 't2' },
  { id: 'm5', participantAId: 't1', participantBId: 't4', status: 'COMPLETED', phase: 'group', groupId: 'gA', roundIndex: 3, courtId: 'court-1', scheduledAt: '2026-07-04T10:20:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 1 }], winnerId: 't1' },
  { id: 'm6', participantAId: 't2', participantBId: 't3', status: 'COMPLETED', phase: 'group', groupId: 'gA', roundIndex: 3, courtId: 'court-2', scheduledAt: '2026-07-04T10:20:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }], winnerId: 't2' },
  { id: 'sf1', participantAId: 't1', participantBId: 't4', status: 'COMPLETED', phase: 'semifinal', phaseWeight: 1.3, roundIndex: 4, courtId: 'court-1', scheduledAt: '2026-07-04T11:20:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 3 }], winnerId: 't1', bracket: null },
  { id: 'sf2', participantAId: 't2', participantBId: 't3', status: 'COMPLETED', phase: 'semifinal', phaseWeight: 1.3, roundIndex: 4, courtId: 'court-2', scheduledAt: '2026-07-04T11:20:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }], winnerId: 't2', bracket: null },
  { id: 'f1', participantAId: 't1', participantBId: 't2', status: 'COMPLETED', phase: 'final', phaseWeight: 1.5, roundIndex: 5, courtId: 'court-1', scheduledAt: '2026-07-04T12:30:00.000Z', sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }], winnerId: 't1', bracket: null }
];

export const demoMvpVotes: MVPVote[] = [
  { id: 'v1', matchId: 'm1', playerId: 'p1', rating: 8.5, weight: 1, source: 'organizer', electedMvp: true },
  { id: 'v2', matchId: 'm2', playerId: 'p5', rating: 8, weight: 1, source: 'referee', electedMvp: true },
  { id: 'v3', matchId: 'm3', playerId: 'p2', rating: 9, weight: 1, source: 'organizer', electedMvp: true },
  { id: 'v4', matchId: 'm6', playerId: 'p3', rating: 8.2, weight: 1, source: 'organizer', electedMvp: true },
  { id: 'v5', matchId: 'f1', playerId: 'p1', rating: 9.5, weight: 1, source: 'organizer', electedMvp: true }
];

export const demoTournament = {
  id: 'demo-tournament',
  name: 'Luxury Padel Demo Open',
  format: 'GROUPS_PLUS_FINALS',
  groups: demoGroups,
  courts: [
    { id: 'court-1', name: 'Campo 1', order: 1 },
    { id: 'court-2', name: 'Campo 2', order: 2 }
  ],
  rules: defaultTournamentRules,
  mvpSettings: defaultMVPSettings,
  players: demoPlayers,
  participants: demoParticipants,
  matches: demoMatches,
  mvpVotes: demoMvpVotes
};
