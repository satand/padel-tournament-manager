export type ParticipantType = 'TEAM';

export type MatchStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'POSTPONED'
  | 'WALKOVER'
  | 'RETIRED';

export type TieBreakerKey =
  | 'points'
  | 'headToHead'
  | 'miniLeague'
  | 'setDiff'
  | 'setsWon'
  | 'gameDiff'
  | 'gamesWon'
  | 'gamesLostAsc'
  | 'avgMvpRating'
  | 'manualDraw'
  | 'manualOrder';

export type ScoreRuleSet = {
  win: number;
  loss: number;
  draw: number;
  winTwoNil: number;
  winTwoOne: number;
  lossOneTwo: number;
  walkoverWin: number;
  walkoverLoss: number;
  retiredLoss: number;
  retiredWin: number;
  disciplinaryPenalty: number;
  bonusGameThreshold?: number;
  bonusGamePoints?: number;
  bonusSetThreshold?: number;
  bonusSetPoints?: number;
};

export type TournamentRules = {
  setsPerMatch: number;
  gamesPerSet: number;
  allowDraws: boolean;
  tieBreakEnabled: boolean;
  superTieBreakEnabled: boolean;
  goldenPointEnabled: boolean;
  killerPointEnabled: boolean;
  points: ScoreRuleSet;
  tieBreakers: TieBreakerKey[];
};

export type Participant = {
  id: string;
  displayName: string;
  type: ParticipantType;
  playerIds: string[];
  level?: number;
  seed?: number;
  manualOrder?: number;
  isWithdrawn?: boolean;
  groupId?: string;
};

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  displayName?: string;
  isWithdrawn?: boolean;
};

export type MatchSetScore = {
  setNumber: number;
  gamesA: number;
  gamesB: number;
  tieBreakA?: number;
  tieBreakB?: number;
  isSuperTieBreak?: boolean;
};

export type Match = {
  id: string;
  participantAId: string;
  participantBId: string;
  status: MatchStatus;
  sets: MatchSetScore[];
  scheduledAt?: string;
  courtId?: string;
  groupId?: string;
  phase?: string;
  phaseWeight?: number;
  roundIndex?: number;
  winnerId?: string;
  note?: string;
  disciplinaryPenalties?: Record<string, number>;
};

export type RankingRow = {
  participantId: string;
  displayName: string;
  position: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  winPercentage: number;
  avgGamesWon: number;
  avgMvpRating?: number;
  manualOrder?: number;
};

export type MVPVote = {
  id: string;
  matchId: string;
  playerId: string;
  rating: number;
  weight: number;
  source: 'organizer' | 'referee' | 'public' | string;
  phaseWeight?: number;
  electedMvp?: boolean;
  penalty?: number;
};

export type MVPSettings = {
  enabled: boolean;
  minMatches: number;
  mvpWeight: number;
  ratingWeight: number;
  semifinalBonus: number;
  finalBonus: number;
  tournamentWinBonus: number;
  penaltiesEnabled: boolean;
};

export type MVPStandingRow = {
  playerId: string;
  displayName: string;
  position: number;
  matchesPlayed: number;
  mvpCount: number;
  avgRating: number;
  weightedRating: number;
  finalBonus: number;
  penalties: number;
  totalScore: number;
  eligible: boolean;
};

export const defaultTournamentRules: TournamentRules = {
  setsPerMatch: 1,
  gamesPerSet: 6,
  allowDraws: false,
  tieBreakEnabled: true,
  superTieBreakEnabled: false,
  goldenPointEnabled: true,
  killerPointEnabled: false,
  points: {
    win: 3,
    loss: 0,
    draw: 1,
    winTwoNil: 3,
    winTwoOne: 2,
    lossOneTwo: 1,
    walkoverWin: 3,
    walkoverLoss: 0,
    retiredLoss: 0,
    retiredWin: 3,
    disciplinaryPenalty: -1,
    bonusGameThreshold: undefined,
    bonusGamePoints: 0,
    bonusSetThreshold: undefined,
    bonusSetPoints: 0
  },
  tieBreakers: [
    'points',
    'headToHead',
    'miniLeague',
    'setDiff',
    'setsWon',
    'gameDiff',
    'gamesWon',
    'gamesLostAsc',
    'avgMvpRating',
    'manualOrder'
  ]
};

export const defaultMVPSettings: MVPSettings = {
  enabled: true,
  minMatches: 2,
  mvpWeight: 5,
  ratingWeight: 1,
  semifinalBonus: 2,
  finalBonus: 3,
  tournamentWinBonus: 5,
  penaltiesEnabled: true
};
