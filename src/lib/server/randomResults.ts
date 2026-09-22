import { prisma } from '@/lib/server/db';
import { validateMatchResult } from '@/lib/domain/validators';
import { rulesForPhase } from '@/lib/domain/scoring';
import { matchPhaseRank, mvpScopeThreshold, type MvpThrough } from '@/lib/domain/mvp';
import type { Match, MatchSetScore, TournamentRules } from '@/lib/domain/types';

export type RandomizableMatch = { id: string; participantAId: string; participantBId: string; phase: string | null };

function randInt(min: number, max: number): number {
  if (max < min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// True se la fase della partita rientra nello scope MVP "conta fino a {through}".
export function mvpAllowedForPhase(phase: string | null | undefined, through: MvpThrough): boolean {
  return matchPhaseRank(phase ?? undefined) <= mvpScopeThreshold(through);
}

// Genera un risultato COMPLETED valido per le regole di punteggio della fase della partita.
export function buildRandomResult(matchId: string, aId: string, bId: string, rules: TournamentRules, phase?: string | null): { winnerId: string; sets: MatchSetScore[] } | null {
  const r = rulesForPhase(rules, phase);
  const winnerIsA = Math.random() < 0.5;
  const winnerId = winnerIsA ? aId : bId;
  const mode = r.scoringMode ?? 'SETS';
  let sets: MatchSetScore[] = [];

  if (mode === 'TIME') {
    // A tempo: tally di game con vincitore ai punti (mai pari).
    const w = randInt(1, 20);
    const l = randInt(0, w - 1);
    sets = [{ setNumber: 1, gamesA: winnerIsA ? w : l, gamesB: winnerIsA ? l : w }];
  } else {
    const target = r.gamesPerSet;
    if (mode === 'GAMES_TARGET') {
      const loser = randInt(0, Math.max(0, target - 1));
      sets = [{ setNumber: 1, gamesA: winnerIsA ? target : loser, gamesB: winnerIsA ? loser : target }];
    } else {
      const winsNeeded = Math.floor(r.setsPerMatch / 2) + 1;
      const loserMax = Math.max(0, target - 2);
      for (let s = 1; s <= winsNeeded; s += 1) {
        const loser = randInt(0, loserMax);
        sets.push({ setNumber: s, gamesA: winnerIsA ? target : loser, gamesB: winnerIsA ? loser : target });
      }
    }
  }

  const preview: Match = { id: matchId, participantAId: aId, participantBId: bId, status: 'COMPLETED', sets, winnerId, phase: phase ?? undefined };
  if (validateMatchResult(preview, rules).length > 0) return null;

  return { winnerId, sets };
}

// mappa participantId -> playerId[] (giocatori della coppia)
export async function loadParticipantPlayers(tournamentId: string): Promise<Map<string, string[]>> {
  const parts = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    include: { team: { include: { members: true } } }
  });
  const map = new Map<string, string[]>();
  for (const p of parts) map.set(p.id, p.team?.members.map((m) => m.playerId) ?? []);
  return map;
}

type ApplyArgs = {
  tournamentId: string;
  match: RandomizableMatch;
  rules: TournamentRules;
  playersMap: Map<string, string[]>;
  mvpEnabled: boolean;
  through: MvpThrough;
};

// Completa una singola partita con esito casuale (+ MVP se nello scope). Ritorna true se completata.
export async function applyRandomResult({ tournamentId, match, rules, playersMap, mvpEnabled, through }: ApplyArgs): Promise<boolean> {
  const result = buildRandomResult(match.id, match.participantAId, match.participantBId, rules, match.phase);
  if (!result) return false;

  const rawScore = { status: 'COMPLETED', sets: result.sets, winnerId: result.winnerId };

  await prisma.matchSet.deleteMany({ where: { matchId: match.id } });
  await prisma.match.update({
    where: { id: match.id },
    data: {
      status: 'COMPLETED',
      winnerId: result.winnerId,
      sets: { create: result.sets.map((s) => ({ ...s })) },
      result: {
        upsert: {
          create: { status: 'COMPLETED', completedAt: new Date(), rawScore },
          update: { status: 'COMPLETED', completedAt: new Date(), rawScore }
        }
      }
    }
  });

  if (mvpEnabled && mvpAllowedForPhase(match.phase, through)) {
    const winnerPlayers = playersMap.get(result.winnerId) ?? [];
    if (winnerPlayers.length > 0) {
      const mvpPlayerId = winnerPlayers[randInt(0, winnerPlayers.length - 1)];
      const mvpRating = Math.round((6 + Math.random() * 3.9) * 10) / 10;
      const mvpPenalty = Math.random() < 0.2 ? 0.5 + Math.floor(Math.random() * 4) * 0.5 : 0;
      await prisma.mVPVote.deleteMany({ where: { matchId: match.id } });
      await prisma.mVPVote.create({
        data: { tournamentId, matchId: match.id, playerId: mvpPlayerId, rating: mvpRating, penalty: mvpPenalty, weight: 1, source: 'organizer' }
      });
    }
  }

  return true;
}

export async function randomizeMatches(args: Omit<ApplyArgs, 'match'> & { matches: RandomizableMatch[] }): Promise<{ filled: number; skipped: number }> {
  let filled = 0;
  let skipped = 0;
  for (const match of args.matches) {
    if (await applyRandomResult({ ...args, match })) filled += 1;
    else skipped += 1;
  }
  return { filled, skipped };
}
