import { describe, expect, it } from 'vitest';
import { defaultTournamentRules, type Match } from '@/lib/domain/types';
import { validateMatchResult, validateSchedulingConflicts } from '@/lib/domain/validators';

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
