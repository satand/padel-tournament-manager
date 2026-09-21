import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { buildRules } from '@/lib/server/serialize';
import { resolveBracket } from '@/lib/server/bracket';
import { writeAuditLog } from '@/lib/server/audit';
import { validateMatchResult } from '@/lib/domain/validators';
import type { Match, MatchSetScore, TournamentRules } from '@/lib/domain/types';

function randInt(min: number, max: number): number {
  if (max < min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Genera un risultato COMPLETED valido per le regole di punteggio del torneo.
function buildRandomResult(matchId: string, aId: string, bId: string, rules: TournamentRules): { winnerId: string; sets: MatchSetScore[] } | null {
  const winnerIsA = Math.random() < 0.5;
  const winnerId = winnerIsA ? aId : bId;
  const mode = rules.scoringMode ?? 'SETS';

  if (mode === 'TIME') {
    return { winnerId, sets: [] };
  }

  const target = rules.gamesPerSet;
  let sets: MatchSetScore[] = [];

  if (mode === 'GAMES_TARGET') {
    const loser = randInt(0, Math.max(0, target - 1));
    sets = [{ setNumber: 1, gamesA: winnerIsA ? target : loser, gamesB: winnerIsA ? loser : target }];
  } else {
    const winsNeeded = Math.floor(rules.setsPerMatch / 2) + 1;
    const loserMax = Math.max(0, target - 2);
    for (let s = 1; s <= winsNeeded; s += 1) {
      const loser = randInt(0, loserMax);
      sets.push({ setNumber: s, gamesA: winnerIsA ? target : loser, gamesB: winnerIsA ? loser : target });
    }
  }

  const preview: Match = { id: matchId, participantAId: aId, participantBId: bId, status: 'COMPLETED', sets, winnerId };
  if (validateMatchResult(preview, rules).length > 0) return null;

  return { winnerId, sets };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { settings: true } });
  if (!tournament?.settings) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const rules = buildRules(tournament.settings);

  const pending = await prisma.match.findMany({
    where: {
      tournamentId: id,
      phase: 'group',
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      participantAId: { not: null },
      participantBId: { not: null }
    }
  });

  if (pending.length === 0) return NextResponse.json({ ok: true, filled: 0, skipped: 0 });

  let filled = 0;
  let skipped = 0;

  for (const match of pending) {
    const aId = match.participantAId as string;
    const bId = match.participantBId as string;
    const result = buildRandomResult(match.id, aId, bId, rules);
    if (!result) {
      skipped += 1;
      continue;
    }

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
    filled += 1;
  }

  await resolveBracket(id);

  await writeAuditLog({
    tournamentId: id,
    entityType: 'Match',
    entityId: id,
    action: 'RESULTS_RANDOMIZED',
    newValue: { filled, skipped }
  });

  return NextResponse.json({ ok: true, filled, skipped });
}
