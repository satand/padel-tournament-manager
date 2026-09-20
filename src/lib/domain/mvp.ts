import type { Match, MVPSettings, MVPStandingRow, MVPVote, Participant, Player } from './types';

export type MvpThrough = 'GROUP' | 'R16' | 'R8' | 'QF' | 'SF' | 'FINAL';

// Soglia di fase per l'MVP: l'MVP considera solo le partite fino alla fase scelta.
export function mvpScopeThreshold(through: MvpThrough): number {
  switch (through) {
    case 'GROUP': return 1;
    case 'R16': return 2;
    case 'R8': return 3;
    case 'QF': return 3;
    case 'SF': return 4;
    case 'FINAL': return 5;
    default: return 5;
  }
}

// Rang di una fase di partita (1 = girone ... 5 = finale).
export function matchPhaseRank(phase?: string): number {
  const p = (phase ?? 'group').toLowerCase();
  if (p === 'group') return 1;
  if (p === 'quarterfinal') return 3;
  if (p === 'semifinal') return 4;
  if (p === 'final') return 5;
  if (p.startsWith('round-')) return 2; // primo turno a eliminazione (R16)
  return 1;
}

export function filterMatchesThroughPhase(matches: Match[], through: MvpThrough): Match[] {
  const threshold = mvpScopeThreshold(through);
  return matches.filter((match) => matchPhaseRank(match.phase) <= threshold);
}

export const MVP_THROUGH_LABEL: Record<MvpThrough, string> = {
  GROUP: 'fase a gironi',
  R16: 'sedicesimi',
  R8: 'ottavi',
  QF: 'quarti di finale',
  SF: 'semifinali',
  FINAL: 'finale'
};

export function calculateMVPStandings(
  players: Player[],
  participants: Participant[],
  matches: Match[],
  votes: MVPVote[],
  settings: MVPSettings,
  tournamentWinnerPlayerIds: string[] = []
): MVPStandingRow[] {
  if (!settings.enabled) return [];

  const playerName = new Map(players.map((player) => [player.id, player.displayName ?? `${player.firstName} ${player.lastName}`]));
  const matchesPlayed = countMatchesPlayedByPlayer(participants, matches);
  const groupedVotes = votes.reduce<Record<string, MVPVote[]>>((acc, vote) => {
    acc[vote.playerId] ??= [];
    acc[vote.playerId].push(vote);
    return acc;
  }, {});

  const rows = players.map<MVPStandingRow>((player) => {
    const playerVotes = groupedVotes[player.id] ?? [];
    const mvpCount = playerVotes.filter((vote) => vote.electedMvp).length;
    const weightedRating = weightedAverage(playerVotes.map((vote) => ({ value: vote.rating, weight: vote.weight * (vote.phaseWeight ?? 1) })));
    const avgRating = simpleAverage(playerVotes.map((vote) => vote.rating));
    const bonusFromPhase = calculatePhaseBonus(playerVotes, matches, settings);
    const winBonus = tournamentWinnerPlayerIds.includes(player.id) ? settings.tournamentWinBonus : 0;
    const penalties = settings.penaltiesEnabled ? playerVotes.reduce((sum, vote) => sum + (vote.penalty ?? 0), 0) : 0;
    const played = matchesPlayed[player.id] ?? 0;
    const eligible = played >= settings.minMatches && !player.isWithdrawn;
    const totalScore = eligible
      ? round(mvpCount * settings.mvpWeight + weightedRating * settings.ratingWeight + bonusFromPhase + winBonus - penalties, 3)
      : 0;

    return {
      playerId: player.id,
      displayName: playerName.get(player.id) ?? player.id,
      position: 0,
      matchesPlayed: played,
      mvpCount,
      avgRating: round(avgRating, 2),
      weightedRating: round(weightedRating, 2),
      finalBonus: round(bonusFromPhase + winBonus, 2),
      penalties: round(penalties, 2),
      totalScore,
      eligible
    };
  });

  return rows
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.mvpCount !== a.mvpCount) return b.mvpCount - a.mvpCount;
      if (b.weightedRating !== a.weightedRating) return b.weightedRating - a.weightedRating;
      return a.displayName.localeCompare(b.displayName);
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function averageMvpRatingByParticipant(participants: Participant[], votes: MVPVote[]): Record<string, number> {
  return participants.reduce<Record<string, number>>((acc, participant) => {
    const participantVotes = votes.filter((vote) => participant.playerIds.includes(vote.playerId));
    if (participantVotes.length > 0) acc[participant.id] = round(simpleAverage(participantVotes.map((vote) => vote.rating)), 2);
    return acc;
  }, {});
}

function countMatchesPlayedByPlayer(participants: Participant[], matches: Match[]): Record<string, number> {
  const playerToParticipants = new Map<string, string[]>();
  for (const participant of participants) {
    for (const playerId of participant.playerIds) {
      const ids = playerToParticipants.get(playerId) ?? [];
      ids.push(participant.id);
      playerToParticipants.set(playerId, ids);
    }
  }

  const played: Record<string, number> = {};
  for (const [playerId, participantIds] of playerToParticipants.entries()) {
    played[playerId] = matches.filter(
      (match) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(match.status) &&
        ((match.participantAId != null && participantIds.includes(match.participantAId)) ||
         (match.participantBId != null && participantIds.includes(match.participantBId)))
    ).length;
  }
  return played;
}

function calculatePhaseBonus(votes: MVPVote[], matches: Match[], settings: MVPSettings): number {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  return votes.reduce((sum, vote) => {
    if (!vote.electedMvp) return sum;
    const phase = matchById.get(vote.matchId)?.phase?.toLowerCase() ?? '';
    if (phase.includes('semi')) return sum + settings.semifinalBonus;
    if (phase.includes('final')) return sum + settings.finalBonus;
    return sum;
  }, 0);
}

function simpleAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(values: { value: number; weight: number }[]): number {
  const weightSum = values.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum === 0) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / weightSum;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
