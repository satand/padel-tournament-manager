import { describe, expect, it } from 'vitest';
import { buildCalendarPdfModel, calendarGroups, matchResult } from '@/lib/domain/calendar';
import type { Match } from '@/lib/domain/types';

const mt = (m: Partial<Match> & { id: string }): Match =>
  ({ participantAId: null, participantBId: null, status: 'SCHEDULED', sets: [], ...m });

const groupNames = new Map([['grA', 'Girone A'], ['grB', 'Girone B']]);

describe('calendar — raggruppamento e ordine', () => {
  it('gironi (A,B,…) poi tabelloni GOLD, SILVER; dentro ogni sezione per data', () => {
    const matches = [
      mt({ id: 'f-gold', phase: 'final', bracket: 'GOLD', roundIndex: 1 }),
      mt({ id: 'f-silv', phase: 'final', bracket: 'SILVER', roundIndex: 1 }),
      mt({ id: 'b1', phase: 'group', groupId: 'grB', scheduledAt: '2026-09-21T12:00:00Z' }),
      mt({ id: 'a2', phase: 'group', groupId: 'grA', scheduledAt: '2026-09-21T16:00:00Z' }),
      mt({ id: 'a1', phase: 'group', groupId: 'grA', scheduledAt: '2026-09-21T09:00:00Z' })
    ];
    const g = calendarGroups(matches, { groupNames });
    expect(g.map((x) => x.label)).toEqual(['Girone A', 'Girone B', 'Tabellone Gold', 'Tabellone Silver']);
    expect(g[0].matches.map((m) => m.id)).toEqual(['a1', 'a2']);
  });

  it('tabellone unico (bracket null) dopo i gironi', () => {
    const g = calendarGroups([
      mt({ id: 'a1', phase: 'group', groupId: 'grA' }),
      mt({ id: 'f', phase: 'final', bracket: null, roundIndex: 1 })
    ], { groupNames });
    expect(g.map((x) => x.label)).toEqual(['Girone A', 'Tabellone']);
  });

  it('round-robin senza gironi/tabelloni finisce in "Calendario"', () => {
    const g = calendarGroups([mt({ id: 'r1', phase: 'round-robin' })], { groupNames });
    expect(g.map((x) => x.label)).toEqual(['Calendario']);
  });
});

describe('calendar — modello PDF', () => {
  const parts = new Map([['p1', 'Rossi/Bianchi'], ['p2', 'Verdi/Neri']]);
  const courts = new Map([['c1', 'Campo Centrale']]);

  it('nasconde la colonna Giorno se tutte le partite sono lo stesso giorno', () => {
    const model = buildCalendarPdfModel({
      title: 'Coppa Test',
      startsAt: '2026-09-21T08:00:00Z',
      participantNames: parts,
      groupNames,
      courtNames: courts,
      matches: [
        mt({ id: 'a1', phase: 'group', groupId: 'grA', scheduledAt: '2026-09-21T09:00:00Z', courtId: 'c1', participantAId: 'p1', participantBId: null, status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 6, gamesB: 3 }, { setNumber: 2, gamesA: 6, gamesB: 4 }], winnerId: 'p1' }),
        mt({ id: 'a2', phase: 'group', groupId: 'grA', scheduledAt: '2026-09-21T16:00:00Z', courtId: 'c1', participantAId: 'p2', participantBId: 'p1' })
      ]
    });
    expect(model.showDay).toBe(false);
    expect(model.dateLabel).toContain('2026');
    const rows = model.sections[0].rows;
    expect(rows[0].teamA).toBe('Rossi/Bianchi');
    expect(rows[0].teamB).toBe('-');
    expect(rows[0].court).toBe('Campo Centrale');
    expect(rows[0].result).toBe('6-3 6-4');
    expect(rows[1].result).toBe('-');
  });

  it('mostra la colonna Giorno su piu giorni', () => {
    const model = buildCalendarPdfModel({
      title: 'Open',
      matches: [
        mt({ id: 'a1', phase: 'group', groupId: 'grA', scheduledAt: '2026-09-21T12:00:00Z' }),
        mt({ id: 'a2', phase: 'group', groupId: 'grA', scheduledAt: '2026-09-22T12:00:00Z' })
      ]
    });
    expect(model.showDay).toBe(true);
  });

  it('matchResult produce il punteggio o un trattino', () => {
    expect(matchResult(mt({ id: 'x', sets: [{ setNumber: 1, gamesA: 7, gamesB: 5 }] }))).toBe('7-5');
    expect(matchResult(mt({ id: 'x' }))).toBe('-');
  });
});
