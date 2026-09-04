import type { Match, Participant, RankingRow, TieBreakerKey, TournamentRules } from './types';

const EPSILON = 0.000001;

type InternalStats = RankingRow & {
  opponents: Record<string, { points: number; gamesWon: number; gamesLost: number; setsWon: number; setsLost: number; played: number; won: number }>;
};

export function calculateRanking(
  participants: Participant[],
  matches: Match[],
  rules: TournamentRules,
  avgMvpRatingByParticipant: Record<string, number> = {}
): RankingRow[] {
  const stats = initialiseStats(participants, avgMvpRatingByParticipant);

  for (const match of matches) {
    if (!isScorableMatch(match)) continue;
    applyMatchToStats(stats, match, rules);
  }

  const rows = Object.values(stats).map((row) => finaliseStats(row));
  const sorted = sortRows(rows, matches, rules.tieBreakers, participants, rules);
  return sorted.map((row, index) => ({ ...row, position: index + 1 }));
}

export function calculateMiniLeague(
  tiedParticipantIds: string[],
  matches: Match[],
  rules: TournamentRules,
  participants: Participant[]
): RankingRow[] {
  const tiedSet = new Set(tiedParticipantIds);
  const miniParticipants = participants.filter((p) => tiedSet.has(p.id));
  const miniMatches = matches.filter(
    (m) => tiedSet.has(m.participantAId) && tiedSet.has(m.participantBId) && isScorableMatch(m)
  );
  return calculateRanking(miniParticipants, miniMatches, { ...rules, tieBreakers: ['points', 'setDiff', 'gameDiff', 'gamesWon', 'gamesLostAsc', 'manualOrder'] });
}

function initialiseStats(participants: Participant[], avgMvpRatingByParticipant: Record<string, number>): Record<string, InternalStats> {
  return participants.reduce<Record<string, InternalStats>>((acc, participant) => {
    acc[participant.id] = {
      participantId: participant.id,
      displayName: participant.displayName,
      position: 0,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      points: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      winPercentage: 0,
      avgGamesWon: 0,
      avgMvpRating: avgMvpRatingByParticipant[participant.id] ?? undefined,
      manualOrder: participant.manualOrder,
      opponents: {}
    };
    return acc;
  }, {});
}

function isScorableMatch(match: Match): boolean {
  return ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(match.status);
}

function applyMatchToStats(stats: Record<string, InternalStats>, match: Match, rules: TournamentRules): void {
  const a = stats[match.participantAId];
  const b = stats[match.participantBId];
  if (!a || !b) return;

  ensureOpponent(a, b.participantId);
  ensureOpponent(b, a.participantId);

  const summary = summariseMatch(match, rules);

  a.played += 1;
  b.played += 1;
  a.setsWon += summary.setsA;
  a.setsLost += summary.setsB;
  b.setsWon += summary.setsB;
  b.setsLost += summary.setsA;
  a.gamesWon += summary.gamesA;
  a.gamesLost += summary.gamesB;
  b.gamesWon += summary.gamesB;
  b.gamesLost += summary.gamesA;

  a.opponents[b.participantId].played += 1;
  b.opponents[a.participantId].played += 1;
  a.opponents[b.participantId].setsWon += summary.setsA;
  a.opponents[b.participantId].setsLost += summary.setsB;
  b.opponents[a.participantId].setsWon += summary.setsB;
  b.opponents[a.participantId].setsLost += summary.setsA;
  a.opponents[b.participantId].gamesWon += summary.gamesA;
  a.opponents[b.participantId].gamesLost += summary.gamesB;
  b.opponents[a.participantId].gamesWon += summary.gamesB;
  b.opponents[a.participantId].gamesLost += summary.gamesA;

  if (summary.winner === 'A') {
    a.won += 1;
    b.lost += 1;
    a.points += summary.pointsA;
    b.points += summary.pointsB;
    a.opponents[b.participantId].won += 1;
    a.opponents[b.participantId].points += summary.pointsA;
    b.opponents[a.participantId].points += summary.pointsB;
  } else if (summary.winner === 'B') {
    b.won += 1;
    a.lost += 1;
    a.points += summary.pointsA;
    b.points += summary.pointsB;
    b.opponents[a.participantId].won += 1;
    b.opponents[a.participantId].points += summary.pointsB;
    a.opponents[b.participantId].points += summary.pointsA;
  } else {
    a.drawn += 1;
    b.drawn += 1;
    a.points += summary.pointsA;
    b.points += summary.pointsB;
    a.opponents[b.participantId].points += summary.pointsA;
    b.opponents[a.participantId].points += summary.pointsB;
  }

  const penalties = match.disciplinaryPenalties ?? {};
  a.points += penalties[a.participantId] ?? 0;
  b.points += penalties[b.participantId] ?? 0;
}

function ensureOpponent(row: InternalStats, opponentId: string): void {
  row.opponents[opponentId] ??= { points: 0, gamesWon: 0, gamesLost: 0, setsWon: 0, setsLost: 0, played: 0, won: 0 };
}

function summariseMatch(match: Match, rules: TournamentRules): {
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  winner: 'A' | 'B' | 'DRAW';
  pointsA: number;
  pointsB: number;
} {
  if (match.status === 'WALKOVER') {
    const winner = match.winnerId === match.participantBId ? 'B' : 'A';
    return winner === 'A'
      ? { setsA: rules.setsPerMatch, setsB: 0, gamesA: rules.gamesPerSet, gamesB: 0, winner, pointsA: rules.points.walkoverWin, pointsB: rules.points.walkoverLoss }
      : { setsA: 0, setsB: rules.setsPerMatch, gamesA: 0, gamesB: rules.gamesPerSet, winner, pointsA: rules.points.walkoverLoss, pointsB: rules.points.walkoverWin };
  }

  if (match.status === 'RETIRED') {
    const winner = match.winnerId === match.participantBId ? 'B' : 'A';
    return winner === 'A'
      ? { setsA: 1, setsB: 0, gamesA: aggregateGames(match).gamesA, gamesB: aggregateGames(match).gamesB, winner, pointsA: rules.points.retiredWin, pointsB: rules.points.retiredLoss }
      : { setsA: 0, setsB: 1, gamesA: aggregateGames(match).gamesA, gamesB: aggregateGames(match).gamesB, winner, pointsA: rules.points.retiredLoss, pointsB: rules.points.retiredWin };
  }

  const setsA = match.sets.filter((set) => set.gamesA > set.gamesB).length;
  const setsB = match.sets.filter((set) => set.gamesB > set.gamesA).length;
  const { gamesA, gamesB } = aggregateGames(match);
  let winner: 'A' | 'B' | 'DRAW' = 'DRAW';
  if (setsA > setsB) winner = 'A';
  if (setsB > setsA) winner = 'B';
  if (setsA === setsB && !rules.allowDraws) winner = gamesA >= gamesB ? 'A' : 'B';

  const base = assignPoints(winner, setsA, setsB, rules);
  const bonusA = calculateBonus(setsA, gamesA, rules);
  const bonusB = calculateBonus(setsB, gamesB, rules);

  return { setsA, setsB, gamesA, gamesB, winner, pointsA: base.pointsA + bonusA, pointsB: base.pointsB + bonusB };
}

function aggregateGames(match: Match): { gamesA: number; gamesB: number } {
  return match.sets.reduce(
    (acc, set) => {
      acc.gamesA += set.gamesA;
      acc.gamesB += set.gamesB;
      return acc;
    },
    { gamesA: 0, gamesB: 0 }
  );
}

function assignPoints(winner: 'A' | 'B' | 'DRAW', setsA: number, setsB: number, rules: TournamentRules): { pointsA: number; pointsB: number } {
  if (winner === 'DRAW') return { pointsA: rules.points.draw, pointsB: rules.points.draw };

  if (winner === 'A') {
    if (setsA === 2 && setsB === 0) return { pointsA: rules.points.winTwoNil, pointsB: rules.points.loss };
    if (setsA === 2 && setsB === 1) return { pointsA: rules.points.winTwoOne, pointsB: rules.points.lossOneTwo };
    return { pointsA: rules.points.win, pointsB: rules.points.loss };
  }

  if (setsB === 2 && setsA === 0) return { pointsA: rules.points.loss, pointsB: rules.points.winTwoNil };
  if (setsB === 2 && setsA === 1) return { pointsA: rules.points.lossOneTwo, pointsB: rules.points.winTwoOne };
  return { pointsA: rules.points.loss, pointsB: rules.points.win };
}

function calculateBonus(setsWon: number, gamesWon: number, rules: TournamentRules): number {
  let bonus = 0;
  if (rules.points.bonusSetThreshold !== undefined && setsWon >= rules.points.bonusSetThreshold) {
    bonus += rules.points.bonusSetPoints ?? 0;
  }
  if (rules.points.bonusGameThreshold !== undefined && gamesWon >= rules.points.bonusGameThreshold) {
    bonus += rules.points.bonusGamePoints ?? 0;
  }
  return bonus;
}

function finaliseStats(row: InternalStats): RankingRow {
  const setDiff = row.setsWon - row.setsLost;
  const gameDiff = row.gamesWon - row.gamesLost;
  return {
    ...row,
    setDiff,
    gameDiff,
    winPercentage: row.played > 0 ? round((row.won / row.played) * 100, 2) : 0,
    avgGamesWon: row.played > 0 ? round(row.gamesWon / row.played, 2) : 0,
    points: round(row.points, 3)
  };
}

function sortRows(rows: RankingRow[], matches: Match[], tieBreakers: TieBreakerKey[], participants: Participant[], rules: TournamentRules): RankingRow[] {
  const ranked = [...rows].sort((a, b) => compareRows(a, b, tieBreakers, matches, participants, rules));
  return resolveMultiwayTies(ranked, matches, rules, participants);
}

function compareRows(a: RankingRow, b: RankingRow, tieBreakers: TieBreakerKey[], matches: Match[], participants: Participant[], rules: TournamentRules): number {
  for (const key of tieBreakers) {
    const result = compareByKey(a, b, key, matches, participants, rules);
    if (Math.abs(result) > EPSILON) return result;
  }
  return a.displayName.localeCompare(b.displayName);
}

function compareByKey(a: RankingRow, b: RankingRow, key: TieBreakerKey, matches: Match[], participants: Participant[], rules: TournamentRules): number {
  switch (key) {
    case 'points':
      return desc(a.points, b.points);
    case 'headToHead':
      return compareHeadToHead(a.participantId, b.participantId, matches, rules, participants);
    case 'miniLeague':
      return 0;
    case 'setDiff':
      return desc(a.setDiff, b.setDiff);
    case 'setsWon':
      return desc(a.setsWon, b.setsWon);
    case 'gameDiff':
      return desc(a.gameDiff, b.gameDiff);
    case 'gamesWon':
      return desc(a.gamesWon, b.gamesWon);
    case 'gamesLostAsc':
      return asc(a.gamesLost, b.gamesLost);
    case 'avgMvpRating':
      return desc(a.avgMvpRating ?? 0, b.avgMvpRating ?? 0);
    case 'manualOrder':
      return asc(a.manualOrder ?? Number.MAX_SAFE_INTEGER, b.manualOrder ?? Number.MAX_SAFE_INTEGER);
    case 'manualDraw':
      return 0;
    default:
      return 0;
  }
}

function compareHeadToHead(aId: string, bId: string, matches: Match[], rules: TournamentRules, participants: Participant[]): number {
  const mini = calculateMiniLeague([aId, bId], matches, rules, participants);
  if (mini.length !== 2) return 0;
  const first = mini[0];
  const second = mini[1];
  if (first.points === second.points && first.gameDiff === second.gameDiff && first.setDiff === second.setDiff) return 0;
  return first.participantId === aId ? -1 : 1;
}

function resolveMultiwayTies(rows: RankingRow[], matches: Match[], rules: TournamentRules, participants: Participant[]): RankingRow[] {
  const output: RankingRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const tied = [rows[index]];
    let next = index + 1;
    while (next < rows.length && samePrimaryTie(rows[index], rows[next])) {
      tied.push(rows[next]);
      next += 1;
    }

    if (tied.length > 2 && rules.tieBreakers.includes('miniLeague')) {
      const mini = calculateMiniLeague(tied.map((r) => r.participantId), matches, rules, participants);
      const orderedIds = mini.map((r) => r.participantId);
      output.push(...[...tied].sort((a, b) => orderedIds.indexOf(a.participantId) - orderedIds.indexOf(b.participantId)));
    } else {
      output.push(...tied);
    }
    index = next;
  }
  return output;
}

function samePrimaryTie(a: RankingRow, b: RankingRow): boolean {
  return a.points === b.points;
}

function desc(a: number, b: number): number {
  return b - a;
}

function asc(a: number, b: number): number {
  return a - b;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
