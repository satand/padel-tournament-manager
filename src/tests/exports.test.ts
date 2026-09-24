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

  it('mostra Girone e Campo per nome e spezza Orario in Giorno + Ora', () => {
    const match: Match = { id: 'm1', participantAId: 'a', participantBId: 'b', status: 'SCHEDULED', phase: 'group', groupId: 'gr1', courtId: 'co1', scheduledAt: '2026-09-21T07:30:00.000Z', sets: [] };
    const csv = matchesToCsv([match], {
      participantNames: new Map([['a', 'Alfa'], ['b', 'Bravo']]),
      groupNames: new Map([['gr1', 'Girone A']]),
      courtNames: new Map([['co1', 'Campo Centrale']])
    });
    const header = csv.split('\n')[0];
    expect(header).toContain('Giorno');
    expect(header).toContain('Ora');
    expect(header).not.toContain('Orario');
    const row = csv.split('\n')[1];
    expect(row).toContain('Girone A');
    expect(row).toContain('Campo Centrale');
    expect(row).not.toContain('gr1');
    expect(row).not.toContain('co1');
    expect(row).not.toContain('2026-09-21T07:30'); // niente ISO grezzo
    expect(row).toMatch(/\d{2}\/\d{2}\/\d{4}/); // Giorno dd/mm/yyyy
    expect(row).toMatch(/\d{2}:\d{2}/); // Ora HH:MM
  });

  it('ordina le righe: girone A, girone B, poi GOLD, poi SILVER', () => {
    const groupNames = new Map([['grA', 'Girone A'], ['grB', 'Girone B']]);
    const names = new Map([['a1', 'A1'], ['a2', 'A2'], ['b1', 'B1'], ['g1', 'G1'], ['s1', 'S1']]);
    const matches: Match[] = [
      { id: 'f-gold', participantAId: 'g1', participantBId: null, status: 'SCHEDULED', sets: [], phase: 'final', bracket: 'GOLD', roundIndex: 1 },
      { id: 'f-silv', participantAId: 's1', participantBId: null, status: 'SCHEDULED', sets: [], phase: 'final', bracket: 'SILVER', roundIndex: 1 },
      { id: 'b1', participantAId: 'b1', participantBId: null, status: 'SCHEDULED', sets: [], phase: 'group', groupId: 'grB', scheduledAt: '2026-09-21T12:00:00Z' },
      { id: 'a2', participantAId: 'a2', participantBId: null, status: 'SCHEDULED', sets: [], phase: 'group', groupId: 'grA', scheduledAt: '2026-09-21T16:00:00Z' },
      { id: 'a1', participantAId: 'a1', participantBId: null, status: 'SCHEDULED', sets: [], phase: 'group', groupId: 'grA', scheduledAt: '2026-09-21T09:00:00Z' }
    ];
    const lines = matchesToCsv(matches, { participantNames: names, groupNames }).split('\n').slice(1);
    const firstTeam = lines.map((l) => l.split(',')[4]); // colonna 'Partecipante A'
    expect(firstTeam).toEqual(['A1', 'A2', 'B1', 'G1', 'S1']);
  });

  it('etichetta BYE lo slot mancante di una partita WALKOVER (bye), non una casella TBD', () => {
    const bye: Match = { id: 'b', participantAId: 'a', participantBId: null, status: 'WALKOVER', sets: [], phase: 'quarterfinal', bracket: null, roundIndex: 1, winnerId: 'a' };
    const tbd: Match = { id: 't', participantAId: 'a', participantBId: null, status: 'SCHEDULED', sets: [], phase: 'final', bracket: null, roundIndex: 2 };
    const [byeRow, tbdRow] = matchesToCsv([bye, tbd], { participantNames: new Map([['a', 'Alpha']]) }).split('\n').slice(1);
    expect(byeRow.split(',')[5]).toBe('BYE'); // 'Partecipante B' = bye
    expect(tbdRow.split(',')[5]).toBe('');    // casella TBD non marcata BYE
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
