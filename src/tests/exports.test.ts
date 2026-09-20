import { describe, expect, it } from 'vitest';
import { matchesToCsv, rankingToCsv } from '@/lib/domain/exports';
import type { Match, RankingRow } from '@/lib/domain/types';

describe('export csv', () => {
  it('usa i nomi e fa l\'escape dei valori con virgola', () => {
    const match: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'final', roundIndex: 1, bracket: 'GOLD', sets: [{ setNumber: 1, gamesA: 6, gamesB: 3 }], winnerId: 'a' };
    const names = new Map<string, string>([['a', 'Alpha, Team'], ['b', 'Beta']]);
    const csv = matchesToCsv([match], names);
    const header = csv.split('\n')[0];
    expect(header).toContain('Vincitore');
    const row = csv.split('\n')[1];
    expect(row).toContain('"Alpha, Team"'); // virgola => cella quotata
    expect(row).toContain('Beta');
    expect(row).toContain('GOLD');
  });

  it('produce intestazione e riga per la classifica', () => {
    const row = {
      participantId: 'a', displayName: 'Alpha', position: 1, played: 2, won: 2, lost: 0, drawn: 0,
      points: 6, setsWon: 2, setsLost: 0, setDiff: 2, gamesWon: 12, gamesLost: 4, gameDiff: 8, winPercentage: 100, avgGamesWon: 6
    } satisfies RankingRow;
    const csv = rankingToCsv([row]);
    expect(csv.split('\n')[0].split(',')[0]).toBe('Posizione');
    expect(csv.split('\n')[1]).toContain('Alpha');
  });
});
