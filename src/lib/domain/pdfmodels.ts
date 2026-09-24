// Modelli PURI per l'export PDF (Partecipanti / Classifica / MVP).
// Nessuna dipendenza da Prisma/Next/pdf-lib: il rendering e' nel layer server.
// `TablePdfModel` e' condiviso con il renderer src/lib/server/pdf.ts (colonne a frazione di larghezza).

import type { MVPStandingRow, Participant, RankingRow } from './types';
import { participantsByGroupOrder } from './calendar';

export type PdfColumn = { h: string; w: number };
export type PdfSection = { label: string; rows: string[][] };
export type TablePdfModel = {
  title: string;
  subtitle: string;
  dateLabel?: string | null;
  emptyMessage?: string;
  columns: PdfColumn[];
  sections: PdfSection[];
};

const sign = (n: number): string => `${n > 0 ? '+' : ''}${n}`;

// Elenco partecipanti raggruppato per girone: un solo nome per riga, MAI il livello.
export function buildParticipantsPdfModel(opts: {
  title: string;
  participants: Participant[];
  groups: { id: string; name: string }[];
  dateLabel?: string | null;
}): TablePdfModel {
  const blocks = participantsByGroupOrder(opts.participants, opts.groups);
  const sections: PdfSection[] = blocks.map((b) => ({
    label: b.name || 'Partecipanti',
    rows: b.teams.map((t) => [t.name])
  }));
  return {
    title: opts.title,
    subtitle: 'Partecipanti',
    dateLabel: opts.dateLabel ?? null,
    emptyMessage: 'Nessun partecipante.',
    columns: [{ h: 'Squadra', w: 1 }],
    sections
  };
}

// Classifica (generale): colonne speculari alla RankingTable a schermo.
export function buildRankingPdfModel(opts: {
  title: string;
  rows: RankingRow[];
  phaseReached?: Map<string, string>;
  dateLabel?: string | null;
  sectionLabel?: string;
}): TablePdfModel {
  const withPhase = !!opts.phaseReached;
  const columns: PdfColumn[] = withPhase
    ? [
        { h: '#', w: 0.05 }, { h: 'Partecipante', w: 0.24 }, { h: 'Fase raggiunta', w: 0.13 },
        { h: 'PG', w: 0.05 }, { h: 'V', w: 0.05 }, { h: 'P', w: 0.05 }, { h: 'Pt', w: 0.06 },
        { h: 'Set', w: 0.18 }, { h: 'Game', w: 0.19 }
      ]
    : [
        { h: '#', w: 0.05 }, { h: 'Partecipante', w: 0.28 },
        { h: 'PG', w: 0.06 }, { h: 'V', w: 0.06 }, { h: 'P', w: 0.06 }, { h: 'Pt', w: 0.07 },
        { h: 'Set', w: 0.21 }, { h: 'Game', w: 0.21 }
      ];
  const sections: PdfSection[] = [
    {
      label: opts.sectionLabel ?? 'Classifica generale',
      rows: opts.rows.map((r) => [
        String(r.position),
        r.displayName,
        ...(withPhase ? [opts.phaseReached?.get(r.participantId) ?? ''] : []),
        String(r.played),
        String(r.won),
        String(r.lost),
        String(r.points),
        `${r.setsWon}-${r.setsLost} (${sign(r.setDiff)})`,
        `${r.gamesWon}-${r.gamesLost} (${sign(r.gameDiff)})`
      ])
    }
  ];
  return { title: opts.title, subtitle: 'Classifica', dateLabel: opts.dateLabel ?? null, emptyMessage: 'Nessuna squadra.', columns, sections };
}

// Classifica MVP: colonne speculari alla MVPTable a schermo.
export function buildMvpPdfModel(opts: {
  title: string;
  rows: MVPStandingRow[];
  dateLabel?: string | null;
  sectionLabel?: string;
}): TablePdfModel {
  const columns: PdfColumn[] = [
    { h: '#', w: 0.05 }, { h: 'Giocatore', w: 0.3 }, { h: 'Partite', w: 0.11 }, { h: 'MVP', w: 0.09 },
    { h: 'Media voto', w: 0.13 }, { h: 'Penalità', w: 0.11 }, { h: 'Totale', w: 0.21 }
  ];
  const sections: PdfSection[] = [
    {
      label: opts.sectionLabel ?? 'Classifica MVP',
      rows: opts.rows.map((r) => [
        String(r.position),
        r.displayName,
        String(r.matchesPlayed),
        String(r.mvpCount),
        String(r.avgRating),
        String(r.penalties),
        String(r.totalScore)
      ])
    }
  ];
  return { title: opts.title, subtitle: 'MVP', dateLabel: opts.dateLabel ?? null, emptyMessage: 'Nessun dato MVP.', columns, sections };
}
