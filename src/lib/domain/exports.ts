import type { Match, MVPStandingRow, RankingRow } from './types';

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

export function matchesToCsv(matches: Match[], names?: Map<string, string>): string {
  const name = (id: string | null) => (id ? names?.get(id) ?? id : '');
  const header = ['Fase', 'Tabellone', 'Turno', 'Girone', 'Partecipante A', 'Partecipante B', 'Campo', 'Orario', 'Stato', 'Risultato', 'Vincitore'];
  const lines = matches.map((match) => [
    match.phase ?? '',
    match.bracket ?? '',
    match.roundIndex ?? '',
    match.groupId ?? '',
    name(match.participantAId),
    name(match.participantBId),
    match.courtId ?? '',
    match.scheduledAt ?? '',
    match.status,
    match.sets.map((set) => `${set.gamesA}-${set.gamesB}`).join(' '),
    name(match.winnerId ?? null)
  ].map(cell).join(','));
  return [header.join(','), ...lines].join('\n');
}

export function mvpToCsv(rows: MVPStandingRow[]): string {
  const header = ['Posizione', 'Giocatore', 'Partite', 'MVP', 'Media voto', 'Voto ponderato', 'Bonus', 'Penalità', 'Totale', 'Elegibile'];
  const lines = rows.map((row) => [row.position, row.displayName, row.matchesPlayed, row.mvpCount, row.avgRating, row.weightedRating, row.finalBonus, row.penalties, row.totalScore, row.eligible].map(cell).join(','));
  return [header.join(','), ...lines].join('\n');
}
