import { describe, expect, it } from 'vitest';
import { assignSchedule, buildFinalBracket, generateKnockoutBracket, generateRoundRobinMatches } from '@/lib/domain/scheduler';
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

describe('buildFinalBracket', () => {
  it('tabellone a 4 con semifinali e finale collegata ai genitori', () => {
    const bm = buildFinalBracket(participants, 'GOLD');
    expect(bm).toHaveLength(3);
    const r1 = bm.filter((m) => m.roundIndex === 1);
    const final = bm.find((m) => m.phase === 'final')!;
    expect(r1).toHaveLength(2);
    expect(r1.every((m) => m.phase === 'semifinal')).toBe(true);
    expect(final.a.kind).toBe('winner');
    expect(final.b.kind).toBe('winner');
    const r1keys = r1.map((m) => m.key);
    expect(r1keys).toContain((final.a as { matchKey: string }).matchKey);
    expect(r1keys).toContain((final.b as { matchKey: string }).matchKey);
    expect(bm.every((m) => m.bracket === 'GOLD')).toBe(true);
  });

  it('gestisce un bye quando i partecipanti non sono potenza di due', () => {
    const bm = buildFinalBracket(participants.slice(0, 3), 'SILVER');
    expect(bm).toHaveLength(3);
    const bye = bm.find((m) => m.status === 'WALKOVER')!;
    expect(bye).toBeTruthy();
    expect(bye.winnerId).toBeTruthy();
    expect([bye.a.kind, bye.b.kind]).toContain('bye');
    // la finale deve agganciarsi come genitore anche alla partita con bye
    const final = bm.find((m) => m.phase === 'final')!;
    const feederKeys = [ (final.a as { matchKey: string }).matchKey, (final.b as { matchKey: string }).matchKey ];
    expect(feederKeys).toContain(bye.key);
  });
});
