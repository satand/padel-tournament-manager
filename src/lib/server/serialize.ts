import { Prisma } from '@prisma/client';
import { defaultMVPSettings, defaultTournamentRules, type MVPSettings, type MVPStandingRow, type MVPVote, type Match as DomainMatch, type Participant, type Player, type TournamentRules } from '@/lib/domain/types';
import { calculateMVPStandings, filterMatchesThroughPhase, type MvpThrough } from '@/lib/domain/mvp';

export const tournamentInclude = {
  settings: true,
  players: true,
  teams: { include: { members: true } },
  participants: true,
  groups: { orderBy: { sortOrder: 'asc' as const } },
  matches: { include: { sets: true, mvpVotes: true }, orderBy: { roundIndex: 'asc' as const } },
  courts: { orderBy: { order: 'asc' as const } }
} satisfies Prisma.TournamentInclude;

export type TournamentWithIncludes = Prisma.TournamentGetPayload<{ include: typeof tournamentInclude }>;

export function buildRules(settings: TournamentWithIncludes['settings']): TournamentRules {
  const scoringMode = (settings?.scoringMode ?? 'SETS') as TournamentRules['scoringMode'];
  return {
    ...defaultTournamentRules,
    scoringMode,
    setsPerMatch: scoringMode === 'GAMES_TARGET' ? 1 : (settings?.setsPerMatch ?? defaultTournamentRules.setsPerMatch),
    gamesPerSet: scoringMode === 'GAMES_TARGET'
      ? (settings?.targetGames ?? settings?.gamesPerSet ?? defaultTournamentRules.gamesPerSet)
      : (settings?.gamesPerSet ?? defaultTournamentRules.gamesPerSet),
    allowDraws: settings?.allowDraws ?? defaultTournamentRules.allowDraws,
    tieBreakEnabled: settings?.tieBreakEnabled ?? defaultTournamentRules.tieBreakEnabled,
    superTieBreakEnabled: settings?.superTieBreakEnabled ?? defaultTournamentRules.superTieBreakEnabled,
    goldenPointEnabled: settings?.goldenPointEnabled ?? defaultTournamentRules.goldenPointEnabled,
    killerPointEnabled: settings?.killerPointEnabled ?? defaultTournamentRules.killerPointEnabled,
    points: (settings?.scoreRules as typeof defaultTournamentRules.points) ?? defaultTournamentRules.points
  };
}

export type TournamentContext = {
  id: string;
  name: string;
  format: string;
  status: string;
  rules: TournamentRules;
  settings: TournamentWithIncludes['settings'];
  participants: Participant[];
  players: Player[];
  matches: DomainMatch[];
  mvpVotes: MVPVote[];
  courts: { id: string; name: string; order: number }[];
  groups: { id: string; name: string }[];
};

export function toDomainContext(tournament: TournamentWithIncludes): TournamentContext {
  const teamPlayerMap = new Map<string, string[]>();
  for (const team of tournament.teams) {
    teamPlayerMap.set(team.id, team.members.map((m) => m.playerId));
  }

  const participants: Participant[] = tournament.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    type: 'TEAM',
    level: p.level ?? undefined,
    playerIds: teamPlayerMap.get(p.teamId) ?? [],
    seed: p.seed ?? undefined,
    manualOrder: p.initialRank ?? undefined,
    isWithdrawn: p.isWithdrawn,
    groupId: p.groupId ?? undefined
  }));

  const players: Player[] = tournament.players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: `${p.firstName} ${p.lastName}`.trim(),
    isWithdrawn: p.isWithdrawn
  }));

  const matches: DomainMatch[] = tournament.matches.map((m) => ({
    id: m.id,
    participantAId: m.participantAId,
    participantBId: m.participantBId,
    status: m.status as DomainMatch['status'],
    sets: m.sets.map((s) => ({
      setNumber: s.setNumber,
      gamesA: s.gamesA,
      gamesB: s.gamesB,
      tieBreakA: s.tieBreakA ?? undefined,
      tieBreakB: s.tieBreakB ?? undefined,
      isSuperTieBreak: s.isSuperTieBreak
    })),
    scheduledAt: m.scheduledAt?.toISOString(),
    courtId: m.courtId ?? undefined,
    groupId: m.groupId ?? undefined,
    phase: m.phase,
    phaseWeight: m.phaseWeight,
    roundIndex: m.roundIndex,
    bracket: m.bracket ?? null,
    winnerId: m.winnerId ?? undefined,
    note: m.note ?? undefined
  }));

  const mvpVotes: MVPVote[] = tournament.matches.flatMap((m) =>
    m.mvpVotes.map((v) => ({
      id: v.id,
      matchId: v.matchId,
      playerId: v.playerId,
      rating: v.rating,
      penalty: v.penalty,
      weight: v.weight,
      source: v.source,
      electedMvp: true
    }))
  );

  const courts = tournament.courts.map((c) => ({ id: c.id, name: c.name, order: c.order }));
  const groups = tournament.groups.map((g) => ({ id: g.id, name: g.name }));

  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    status: tournament.status,
    rules: buildRules(tournament.settings),
    settings: tournament.settings,
    participants,
    players,
    matches,
    mvpVotes,
    courts,
    groups
  };
}

export function buildMVPSettings(settings: TournamentWithIncludes['settings']): MVPSettings {
  const weights = (settings?.mvpWeights as Partial<MVPSettings>) ?? {};
  return {
    ...defaultMVPSettings,
    ...weights,
    enabled: settings?.mvpEnabled ?? defaultMVPSettings.enabled
  };
}

export function computeMvp(ctx: TournamentContext): { rows: MVPStandingRow[]; through: MvpThrough } {
  const through = (ctx.settings?.mvpThroughPhase ?? 'FINAL') as MvpThrough;
  const scoped = filterMatchesThroughPhase(ctx.matches, through);
  const allowed = new Set(scoped.map((m) => m.id));
  const votes = ctx.mvpVotes.filter((v) => allowed.has(v.matchId));

  let winnerPlayerIds: string[] = [];
  if (through === 'FINAL') {
    const decided = ctx.matches
      .filter((m) => m.phase === 'final' && (m.bracket === 'GOLD' || m.bracket === null || m.bracket === undefined))
      .find((m) => m.winnerId && ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status));
    if (decided?.winnerId) {
      winnerPlayerIds = ctx.participants.find((p) => p.id === decided.winnerId)?.playerIds ?? [];
    }
  }

  const rows = calculateMVPStandings(ctx.players, ctx.participants, scoped, votes, buildMVPSettings(ctx.settings), winnerPlayerIds);
  return { rows, through };
}
