import type { Match, MVPSettings, MVPStandingRow, MVPVote, Participant, Player } from './types';

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
        (participantIds.includes(match.participantAId) || participantIds.includes(match.participantBId))
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
