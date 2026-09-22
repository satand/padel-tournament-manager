import { describe, expect, it } from 'vitest';
import { defaultTournamentRules, type Match, type TournamentRules } from '@/lib/domain/types';
import { validateMatchResult, validateSchedulingConflicts } from '@/lib/domain/validators';
import { rulesForPhase } from '@/lib/domain/scoring';

describe('validazioni risultati e calendario', () => {
  it('rifiuta punteggi impossibili', () => {
    const match: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 5, gamesB: 4 }] };
    expect(validateMatchResult(match, defaultTournamentRules).length).toBeGreaterThan(0);
  });

  it('accetta tie-break 7-6 se abilitato', () => {
    const match: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', sets: [{ setNumber: 1, gamesA: 7, gamesB: 6, tieBreakA: 7, tieBreakB: 5 }] };
    expect(validateMatchResult(match, defaultTournamentRules)).toEqual([]);
  });

  it('rileva campo occupato e giocatore in doppio slot', () => {
    const matches: Match[] = [
      { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'SCHEDULED', sets: [], courtId: 'c1', scheduledAt: '2026-07-04T09:00:00.000Z' },
      { id: 'm2', participantAId: 'a', participantBId: 'c', status: 'SCHEDULED', sets: [], courtId: 'c1', scheduledAt: '2026-07-04T09:00:00.000Z' }
    ];
    expect(validateSchedulingConflicts(matches)).toHaveLength(2);
  });
});

describe('scoring modes', () => {
  it('TIME: serve un vincitore e i game non possono essere pari', () => {
    const rules = { ...defaultTournamentRules, scoringMode: 'TIME' as const };
    const withWinner: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'group', sets: [{ setNumber: 1, gamesA: 12, gamesB: 9 }], winnerId: 'a' };
    expect(validateMatchResult(withWinner, rules)).toEqual([]);
    const tie: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'group', sets: [{ setNumber: 1, gamesA: 10, gamesB: 10 }], winnerId: 'a' };
    expect(validateMatchResult(tie, rules).length).toBeGreaterThan(0);
  });

  it('GAMES_TARGET: il vincitore deve raggiungere esattamente il target', () => {
    const rules = { ...defaultTournamentRules, scoringMode: 'GAMES_TARGET' as const, gamesPerSet: 16 };
    const ok: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'group', sets: [{ setNumber: 1, gamesA: 16, gamesB: 11 }], winnerId: 'a' };
    expect(validateMatchResult(ok, rules)).toEqual([]);
    const overshoot: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'group', sets: [{ setNumber: 1, gamesA: 20, gamesB: 15 }], winnerId: 'a' };
    expect(validateMatchResult(overshoot, rules).length).toBeGreaterThan(0);
  });
});

describe('punteggio per fase (girone vs finale)', () => {
  const rules: TournamentRules = {
    ...defaultTournamentRules,
    scoringMode: 'GAMES_TARGET',
    gamesPerSet: 21,
    finalScoring: { scoringMode: 'SETS', setsPerMatch: 3, gamesPerSet: 6 }
  };

  it('rulesForPhase: finale usa l\'override, girone le regole top-level', () => {
    expect(rulesForPhase(rules, 'final').scoringMode).toBe('SETS');
    expect(rulesForPhase(rules, 'group').scoringMode).toBe('GAMES_TARGET');
    expect(rulesForPhase({ ...rules, finalScoring: undefined }, 'final').scoringMode).toBe('GAMES_TARGET');
  });

  it('finale in Set (Bo3): serve vincere 2 set', () => {
    const incomplete: Match = { id: 'f1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'final', sets: [{ setNumber: 1, gamesA: 6, gamesB: 2 }], winnerId: 'a' };
    expect(validateMatchResult(incomplete, rules).some((i) => i.field === 'sets')).toBe(true);
    const ok: Match = { id: 'f1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'final', sets: [{ setNumber: 1, gamesA: 6, gamesB: 2 }, { setNumber: 2, gamesA: 6, gamesB: 4 }], winnerId: 'a' };
    expect(validateMatchResult(ok, rules)).toEqual([]);
  });

  it('girone in A target: il vincitore deve arrivare a 21', () => {
    const ok: Match = { id: 'g1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'group', sets: [{ setNumber: 1, gamesA: 21, gamesB: 15 }], winnerId: 'a' };
    expect(validateMatchResult(ok, rules)).toEqual([]);
    const bad: Match = { id: 'g1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'group', sets: [{ setNumber: 1, gamesA: 6, gamesB: 2 }], winnerId: 'a' };
    expect(validateMatchResult(bad, rules).length).toBeGreaterThan(0);
  });
});
