import { describe, expect, it } from 'vitest';
import { buildMvpPdfModel, buildParticipantsPdfModel, buildRankingPdfModel } from '@/lib/domain/pdfmodels';
import type { MVPStandingRow, Participant, RankingRow } from '@/lib/domain/types';

const pt = (id: string, level: number | undefined, groupId?: string): Participant =>
  ({ id, displayName: id, type: 'TEAM', playerIds: [], level, groupId });

const rk = (r: Pick<RankingRow, 'participantId' | 'displayName'> & Partial<RankingRow>): RankingRow =>
  ({ position: 1, played: 0, won: 0, lost: 0, drawn: 0, points: 0, setsWon: 0, setsLost: 0, setDiff: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, winPercentage: 0, avgGamesWon: 0, ...r });

const mvp = (r: Pick<MVPStandingRow, 'playerId' | 'displayName'> & Partial<MVPStandingRow>): MVPStandingRow =>
  ({ position: 1, matchesPlayed: 0, mvpCount: 0, avgRating: 0, weightedRating: 0, penalties: 0, totalScore: 0, ...r });

describe('pdfmodels — Partecipanti', () => {
  const groups = [{ id: 'grA', name: 'Girone A' }, { id: 'grB', name: 'Girone B' }];

  it('blocchi per girone, un solo nome per riga, MAI il livello', () => {
    const model = buildParticipantsPdfModel({
      title: 'Torneo',
      groups,
      participants: [pt('B1', 5, 'grB'), pt('A1', 3, 'grA'), pt('A2', 8.55, 'grA'), pt('B2', 7, 'grB')]
    });
    expect(model.columns).toEqual([{ h: 'Squadra', w: 1 }]);
    expect(model.sections.map((s) => s.label)).toEqual(['Girone A', 'Girone B']);
    // ordinate per livello decrescente
    expect(model.sections[0].rows).toEqual([['A2'], ['A1']]);
    expect(model.sections[1].rows).toEqual([['B2'], ['B1']]);
    // nessun livello esposto nel PDF
    const flat = model.sections.flatMap((s) => s.rows.flat()).join('|');
    expect(flat).not.toContain('8.55');
    expect(flat).not.toContain('5');
    expect(flat).not.toContain('liv');
  });

  it('senza gironi: un unico blocco "Partecipanti"', () => {
    const model = buildParticipantsPdfModel({ title: 'T', groups: [], participants: [pt('X', 2), pt('Y', 9)] });
    expect(model.sections[0].label).toBe('Partecipanti');
    expect(model.sections[0].rows).toEqual([['Y'], ['X']]);
  });
});

describe('pdfmodels — Classifica (ranking)', () => {
  it('senza "Fase raggiunta": 8 colonne, Set/Game con segno', () => {
    const model = buildRankingPdfModel({
      title: 'T',
      rows: [rk({ participantId: 'a', displayName: 'Alpha', position: 1, played: 3, won: 2, lost: 1, points: 6, setsWon: 4, setsLost: 1, setDiff: 3, gamesWon: 30, gamesLost: 20, gameDiff: -2 })]
    });
    expect(model.columns.map((c) => c.h)).toEqual(['#', 'Partecipante', 'PG', 'V', 'P', 'Pt', 'Set', 'Game']);
    expect(model.sections[0].rows[0]).toEqual(['1', 'Alpha', '3', '2', '1', '6', '4-1 (+3)', '30-20 (-2)']);
    expect(model.subtitle).toBe('Classifica');
  });

  it('con "Fase raggiunta": colonna extra popolata', () => {
    const phase = new Map([['a', 'Semifinale']]);
    const model = buildRankingPdfModel({ title: 'T', rows: [rk({ participantId: 'a', displayName: 'Alpha' })], phaseReached: phase });
    expect(model.columns.map((c) => c.h)).toEqual(['#', 'Partecipante', 'Fase raggiunta', 'PG', 'V', 'P', 'Pt', 'Set', 'Game']);
    expect(model.sections[0].rows[0].slice(0, 3)).toEqual(['1', 'Alpha', 'Semifinale']);
  });
});

describe('pdfmodels — MVP', () => {
  it('colonne come la MVPTable e valori in riga', () => {
    const model = buildMvpPdfModel({
      title: 'T',
      rows: [mvp({ playerId: 'p1', displayName: 'Paperino', position: 1, matchesPlayed: 5, mvpCount: 2, avgRating: 7.5, penalties: 1, totalScore: 42 })]
    });
    expect(model.columns.map((c) => c.h)).toEqual(['#', 'Giocatore', 'Partite', 'MVP', 'Media voto', 'Penalità', 'Totale']);
    expect(model.sections[0].rows[0]).toEqual(['1', 'Paperino', '5', '2', '7.5', '1', '42']);
    expect(model.subtitle).toBe('MVP');
  });
});
