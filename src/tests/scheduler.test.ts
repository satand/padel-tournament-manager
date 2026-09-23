import { describe, expect, it } from 'vitest';
import { assignSchedule, buildFinalBracket, generateKnockoutBracket, generateRoundRobinMatches, type ScheduleInput } from '@/lib/domain/scheduler';
import type { Participant } from '@/lib/domain/types';

const participants: Participant[] = [
  { id: 'a', displayName: 'A', type: 'TEAM', playerIds: ['a1'] },
  { id: 'b', displayName: 'B', type: 'TEAM', playerIds: ['b1'] },
  { id: 'c', displayName: 'C', type: 'TEAM', playerIds: ['c1'] },
  { id: 'd', displayName: 'D', type: 'TEAM', playerIds: ['d1'] }
];

const courts = [{ id: 'court-1', name: 'Campo 1', order: 1 }, { id: 'court-2', name: 'Campo 2', order: 2 }];
const startsAt = '2026-07-04T09:00:00.000Z';
const base: Omit<ScheduleInput, 'courts' | 'startsAt' | 'matchDurationMinutes' | 'warmUpMinutes' | 'changeoverMinutes' | 'maxMatchesPerPlayerDay'> = { participants };

describe('scheduler', () => {
  it('genera round robin completo', () => {
    const matches = generateRoundRobinMatches(participants);
    expect(matches).toHaveLength(6);
  });

  it('assegna campi e orari', () => {
    const matches = generateRoundRobinMatches(participants);
    const scheduled = assignSchedule(matches, {
      ...base,
      courts,
      startsAt,
      warmUpMinutes: 5,
      matchDurationMinutes: 30,
      changeoverMinutes: 10,
      maxMatchesPerPlayerDay: 5
    });
    expect(scheduled.every((match) => match.courtId && match.scheduledAt)).toBe(true);
  });

  it('distribuisce le partite con passo = riscaldamento + match + cambio', () => {
    const matches = generateRoundRobinMatches(participants);
    const scheduled = assignSchedule(matches, {
      ...base, courts: [courts[0]], startsAt,
      warmUpMinutes: 5, matchDurationMinutes: 30, changeoverMinutes: 5, maxMatchesPerPlayerDay: null
    });
    expect(scheduled.length).toBe(6);
    const t0 = Date.parse(scheduled[0].scheduledAt!);
    const t1 = Date.parse(scheduled[1].scheduledAt!);
    expect(t0).toBe(Date.parse(startsAt));
    expect((t1 - t0) / 60000).toBe(40); // slot = 5 + 30 + 5
  });

  it('"senza limite" piazza tutte le partite; un limite le riduce', () => {
    const matches = generateRoundRobinMatches(participants);
    const unlimited = assignSchedule(matches, {
      ...base, courts, startsAt, warmUpMinutes: 0, matchDurationMinutes: 30, changeoverMinutes: 0, maxMatchesPerPlayerDay: null
    });
    const capped = assignSchedule(matches, {
      ...base, courts, startsAt, warmUpMinutes: 0, matchDurationMinutes: 30, changeoverMinutes: 0, maxMatchesPerPlayerDay: 1
    });
    expect(unlimited.length).toBe(6);
    expect(capped.length).toBeLessThan(6);
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
    const final = bm.find((m) => m.phase === 'final')!;
    const feederKeys = [(final.a as { matchKey: string }).matchKey, (final.b as { matchKey: string }).matchKey];
    expect(feederKeys).toContain(bye.key);
  });
});
