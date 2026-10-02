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

  it('con assignTimes=false assegna solo il campo, nessun orario', () => {
    const matches = generateRoundRobinMatches(participants);
    const scheduled = assignSchedule(matches, {
      ...base,
      courts,
      startsAt,
      warmUpMinutes: 5,
      matchDurationMinutes: 30,
      changeoverMinutes: 10,
      maxMatchesPerPlayerDay: 5,
      assignTimes: false
    });
    expect(scheduled.every((match) => match.courtId != null)).toBe(true);
    expect(scheduled.every((match) => match.scheduledAt == null)).toBe(true);
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

  it('con cap basso nessuna partita persa: slitta al giorno dopo', () => {
    const matches = generateRoundRobinMatches(participants); // 4 squadre -> 6 gare, 3 per squadra
    const scheduled = assignSchedule(matches, {
      ...base, courts: [courts[0]], startsAt,
      warmUpMinutes: 0, matchDurationMinutes: 30, changeoverMinutes: 0, maxMatchesPerPlayerDay: 1
    });
    expect(scheduled.length).toBe(6); // nessuna partita scartata
    const days = new Set(scheduled.map((m) => Date.parse(m.scheduledAt!) / 86400000 | 0));
    expect(days.size).toBeGreaterThan(1); // si estende su piu' giorni
  });

  it('un girone = un campo; gironi su campi diversi partono in parallelo', () => {
    const gA = generateRoundRobinMatches([participants[0], participants[1]], 'gA');
    const gB = generateRoundRobinMatches([participants[2], participants[3]], 'gB');
    const scheduled = assignSchedule([...gA, ...gB], {
      ...base, courts, startsAt, warmUpMinutes: 5, matchDurationMinutes: 30, changeoverMinutes: 10, maxMatchesPerPlayerDay: null
    });
    const inA = scheduled.filter((m) => m.groupId === 'gA');
    const inB = scheduled.filter((m) => m.groupId === 'gB');
    expect(new Set(inA.map((m) => m.courtId)).size).toBe(1);
    expect(new Set(inB.map((m) => m.courtId)).size).toBe(1);
    expect(inA[0].courtId).not.toBe(inB[0].courtId);
    expect(inA[0].scheduledAt).toBe(startsAt);
    expect(inB[0].scheduledAt).toBe(startsAt); // partenza simultanea
  });

  it("con piu' gironi che campi, il girone in coda attende la liberazione del campo", () => {
    const p = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => ({ id, displayName: id, type: 'TEAM' as const, playerIds: [id] }));
    const g1 = generateRoundRobinMatches([p[0], p[1], p[2]], 'g1');
    const g2 = generateRoundRobinMatches([p[3], p[4], p[5]], 'g2');
    const g3 = generateRoundRobinMatches([p[0], p[3], p[1]], 'g3'); // 3 gironi, 2 campi -> g3 condivide il campo di g1
    const scheduled = assignSchedule([...g1, ...g2, ...g3], {
      ...base, courts, startsAt, warmUpMinutes: 0, matchDurationMinutes: 30, changeoverMinutes: 0, maxMatchesPerPlayerDay: null
    });
    const inG1 = scheduled.filter((m) => m.groupId === 'g1');
    const inG3 = scheduled.filter((m) => m.groupId === 'g3');
    expect(inG3[0].courtId).toBe(inG1[0].courtId); // stesso campo (coda)
    const g1Last = Math.max(...inG1.map((m) => Date.parse(m.scheduledAt!)));
    const g3First = Math.min(...inG3.map((m) => Date.parse(m.scheduledAt!)));
    expect(g3First).toBeGreaterThan(g1Last); // g3 parte solo dopo la fine di g1
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
