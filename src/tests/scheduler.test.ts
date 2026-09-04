import { describe, expect, it } from 'vitest';
import { assignSchedule, generateKnockoutBracket, generateRoundRobinMatches } from '@/lib/domain/scheduler';
import type { Participant } from '@/lib/domain/types';

const participants: Participant[] = [
  { id: 'a', displayName: 'A', type: 'TEAM', playerIds: ['a1'] },
  { id: 'b', displayName: 'B', type: 'TEAM', playerIds: ['b1'] },
  { id: 'c', displayName: 'C', type: 'TEAM', playerIds: ['c1'] },
  { id: 'd', displayName: 'D', type: 'TEAM', playerIds: ['d1'] }
];

describe('scheduler', () => {
  it('genera round robin completo', () => {
    const matches = generateRoundRobinMatches(participants);
    expect(matches).toHaveLength(6);
  });

  it('assegna campi e orari', () => {
    const matches = generateRoundRobinMatches(participants);
    const scheduled = assignSchedule(matches, {
      participants,
      courts: [{ id: 'court-1', name: 'Campo 1', order: 1 }, { id: 'court-2', name: 'Campo 2', order: 2 }],
      startsAt: '2026-07-04T09:00:00.000Z',
      matchDurationMinutes: 30,
      minRestMinutes: 10,
      maxMatchesPerPlayerDay: 5
    });
    expect(scheduled.every((match) => match.courtId && match.scheduledAt)).toBe(true);
  });

  it('genera tabellone knockout con finale', () => {
    const bracket = generateKnockoutBracket(participants);
    expect(bracket.some((match) => match.phase === 'final')).toBe(true);
  });
});
