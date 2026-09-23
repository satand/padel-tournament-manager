import { describe, expect, it } from 'vitest';
import { bracketRankingsToCsv, matchesToCsv, rankingToCsv } from '@/lib/domain/exports';
import type { Match, RankingRow } from '@/lib/domain/types';

describe('export csv', () => {
  it('usa i nomi e fa l\'escape dei valori con virgola', () => {
    const match: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'COMPLETED', phase: 'final', roundIndex: 1, bracket: 'GOLD', sets: [{ setNumber: 1, gamesA: 6, gamesB: 3 }], winnerId: 'a' };
    const names = new Map<string, string>([['a', 'Alpha, Team'], ['b', 'Beta']]);
    const csv = matchesToCsv([match], { participantNames: names });
    const header = csv.split('\n')[0];
    expect(header).toContain('Vincitore');
    const row = csv.split('\n')[1];
    expect(row).toContain('"Alpha, Team"'); // virgola => cella quotata
    expect(row).toContain('Beta');
    expect(row).toContain('GOLD');
    expect(row).toContain('Finale'); // fase in italiano, non 'final'
  });

  it('mostra Girone e Campo per nome e Orario leggibile', () => {
    const match: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'SCHEDULED', phase: 'group', groupId: 'gr1', courtId: 'co1', scheduledAt: '2026-09-21T07:30:00.000Z', sets: [] };
    const csv = matchesToCsv([match], {
      participantNames: new Map([['a', 'Alfa'], ['b', 'Bravo']]),
      groupNames: new Map([['gr1', 'Girone A']]),
      courtNames: new Map([['co1', 'Campo Centrale']])
    });
    const row = csv.split('\n')[1];
    expect(row).toContain('Girone A');
    expect(row).toContain('Campo Centrale');
    expect(row).not.toContain('gr1');
    expect(row).not.toContain('co1');
    expect(row).not.toContain('2026-09-21T07:30'); // niente ISO grezzo
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

  it('Classifica Generale: colonna "Fase raggiunta" solo se passata la mappa', () => {
    const row = {
      participantId: 'a', displayName: 'Alpha', position: 1, played: 2, won: 2, lost: 0, drawn: 0,
      points: 6, setsWon: 2, setsLost: 0, setDiff: 2, gamesWon: 12, gamesLost: 4, gameDiff: 8, winPercentage: 100, avgGamesWon: 6
    } satisfies RankingRow;
    const withPhase = rankingToCsv([row], new Map([['a', 'Campione (Gold)']]));
    expect(withPhase.split('\n')[0]).toContain('Fase raggiunta');
    expect(withPhase.split('\n')[1]).toContain('Campione (Gold)');
    const withoutPhase = rankingToCsv([row]);
    expect(withoutPhase.split('\n')[0]).not.toContain('Fase raggiunta');
  });

  it('Classifica Finali CSV: colonne uniformi con Tabellone e Fase raggiunta', () => {
    const row = {
      participantId: 'a', displayName: 'Alpha', position: 1, played: 1, won: 1, lost: 0, drawn: 0,
      points: 3, setsWon: 1, setsLost: 0, setDiff: 1, gamesWon: 6, gamesLost: 3, gameDiff: 3, winPercentage: 100, avgGamesWon: 6
    } satisfies RankingRow;
    const csv = bracketRankingsToCsv([{ tabellone: 'Tabellone Gold', rows: [row], phaseReached: new Map([['a', 'Campione']]) }]);
    expect(csv.split('\n')[0].split(',')).toEqual(['Tabellone', 'Posizione', 'Partecipante', 'Fase raggiunta', 'PG', 'V', 'P', 'N', 'Punti', 'Diff set', 'Diff game']);
    expect(csv.split('\n')[1]).toContain('Tabellone Gold');
    expect(csv.split('\n')[1]).toContain('Campione');
  });
});
