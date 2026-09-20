import type { Match, MVPStandingRow, RankingRow } from './types';

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
  ].join(','));
  return [header.join(','), ...lines].join('\n');
}

export function matchesToCsv(matches: Match[]): string {
  const header = ['ID', 'Fase', 'Turno', 'Partecipante A', 'Partecipante B', 'Campo', 'Orario', 'Stato', 'Risultato'];
  const lines = matches.map((match) => [
    match.id,
    match.phase ?? '',
    match.roundIndex ?? '',
    match.participantAId ?? '',
    match.participantBId ?? '',
    match.courtId ?? '',
    match.scheduledAt ?? '',
    match.status,
    match.sets.map((set) => `${set.gamesA}-${set.gamesB}`).join(' ')
  ].join(','));
  return [header.join(','), ...lines].join('\n');
}

export function mvpToCsv(rows: MVPStandingRow[]): string {
  const header = ['Posizione', 'Giocatore', 'Partite', 'MVP', 'Media voto', 'Voto ponderato', 'Bonus', 'Penalità', 'Totale', 'Elegibile'];
  const lines = rows.map((row) => [row.position, row.displayName, row.matchesPlayed, row.mvpCount, row.avgRating, row.weightedRating, row.finalBonus, row.penalties, row.totalScore, row.eligible].join(','));
  return [header.join(','), ...lines].join('\n');
}
