import type { Match, MVPStandingRow, RankingRow } from './types';
import type { BracketPlacementTable } from './finals';
import { phaseLabel, bracketLabel } from './labels';

function cell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rankingToCsv(rows: RankingRow[]): string {
  const header = ['Posizione', 'Partecipante', 'PG', 'V', 'P', 'N', 'Punti', 'Set+', 'Set-', 'Diff set', 'Game+', 'Game-', 'Diff game', '% Vittorie', 'Media game'];
  const lines = rows.map((row) => [
    row.position,
    row.displayName,
    row.played,
    row.won,
    row.lost,
    row.drawn,
    row.points,
    row.setsWon,
    row.setsLost,
    row.setDiff,
    row.gamesWon,
    row.gamesLost,
    row.gameDiff,
    row.winPercentage,
    row.avgGamesWon
  ].map(cell).join(','));
  return [header.join(','), ...lines].join('\n');
}

export function groupRankingsToCsv(groups: { name: string; rows: RankingRow[] }[]): string {
  const header = ['Girone', 'Posizione', 'Partecipante', 'PG', 'V', 'P', 'N', 'Punti', 'Diff set', 'Diff game'];
  const lines = groups.flatMap((group) => group.rows.map((row) => [
    group.name,
    row.position,
    row.displayName,
    row.played,
    row.won,
    row.lost,
    row.drawn,
    row.points,
    row.setDiff,
    row.gameDiff
  ].map(cell).join(',')));
  return [header.join(','), ...lines].join('\n');
}

export function matchesToCsv(
  matches: Match[],
  opts: { participantNames?: Map<string, string>; groupNames?: Map<string, string>; courtNames?: Map<string, string> } = {}
): string {
  const { participantNames, groupNames, courtNames } = opts;
  const pname = (id: string | null | undefined) => (id ? participantNames?.get(id) ?? id : '');
  const gname = (id: string | null | undefined) => (id ? groupNames?.get(id) ?? '' : '');
  const cname = (id: string | null | undefined) => (id ? courtNames?.get(id) ?? '' : '');
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const header = ['Fase', 'Tabellone', 'Turno', 'Girone', 'Partecipante A', 'Partecipante B', 'Campo', 'Orario', 'Stato', 'Risultato', 'Vincitore'];
  const lines = matches.map((match) => [
    phaseLabel(match.phase),
    match.bracket ?? '',
    match.roundIndex ?? '',
    gname(match.groupId),
    pname(match.participantAId),
    pname(match.participantBId),
    cname(match.courtId),
    when(match.scheduledAt),
    match.status,
    match.sets.map((set) => `${set.gamesA}-${set.gamesB}`).join(' '),
    pname(match.winnerId ?? null)
  ].map(cell).join(','));
  return [header.join(','), ...lines].join('\n');
}

export function mvpToCsv(rows: MVPStandingRow[]): string {
  const header = ['Posizione', 'Giocatore', 'Partite', 'MVP', 'Media voto', 'Voto ponderato', 'Penalità', 'Totale'];
  const lines = rows.map((row) => [row.position, row.displayName, row.matchesPlayed, row.mvpCount, row.avgRating, row.weightedRating, row.penalties, row.totalScore].map(cell).join(','));
  return [header.join(','), ...lines].join('\n');
}

export function bracketPlacementsToCsv(tables: BracketPlacementTable[]): string {
  const header = ['Tabellone', 'Posizione', 'Partecipante', 'Fase raggiunta', 'V', 'P'];
  const lines = tables.flatMap((table) => table.placements.map((p) => [
    bracketLabel(table.bracket) || 'Unico',
    p.position,
    p.displayName,
    p.phaseLabel,
    p.wins,
    p.losses
  ].map(cell).join(',')));
  return [header.join(','), ...lines].join('\n');
}
