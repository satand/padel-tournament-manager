import { NextResponse } from 'next/server';
import { defaultTournamentRules } from '@/lib/domain/types';
import { validateMatchResult, resultPayloadSchema } from '@/lib/domain/validators';
import { prisma } from '@/lib/server/db';
import { writeAuditLog } from '@/lib/server/audit';

export async function PUT(request: Request, context: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await context.params;
  const body = await request.json();
  const parsed = resultPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { settings: true } });
  if (!tournament?.settings) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { sets: true } });
  if (!match) return NextResponse.json({ error: 'Partita non trovata.' }, { status: 404 });

  const rules = {
    ...defaultTournamentRules,
    setsPerMatch: tournament.settings.setsPerMatch,
    gamesPerSet: tournament.settings.gamesPerSet,
    allowDraws: tournament.settings.allowDraws,
    tieBreakEnabled: tournament.settings.tieBreakEnabled,
    superTieBreakEnabled: tournament.settings.superTieBreakEnabled,
    goldenPointEnabled: tournament.settings.goldenPointEnabled,
    killerPointEnabled: tournament.settings.killerPointEnabled,
    points: tournament.settings.scoreRules as typeof defaultTournamentRules.points
  };

  const domainMatch = {
    id: match.id,
    participantAId: match.participantAId,
    participantBId: match.participantBId,
    status: parsed.data.status,
    sets: parsed.data.sets,
    winnerId: parsed.data.winnerId
  };

  const issues = validateMatchResult(domainMatch, rules);
  if (issues.length > 0) return NextResponse.json({ issues }, { status: 422 });

  await prisma.matchSet.deleteMany({ where: { matchId } });
  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: parsed.data.status,
      winnerId: parsed.data.winnerId,
      note: parsed.data.note,
      sets: { create: parsed.data.sets.map((set) => ({ ...set })) },
      result: {
        upsert: {
          create: { status: parsed.data.status, completedAt: new Date(), rawScore: parsed.data },
          update: { status: parsed.data.status, completedAt: new Date(), rawScore: parsed.data }
        }
      }
    }
  });

  if (parsed.data.mvpPlayerId && parsed.data.mvpRating) {
    await prisma.mVPVote.deleteMany({ where: { matchId } });
    await prisma.mVPVote.create({
      data: {
        tournamentId: id,
        matchId,
        playerId: parsed.data.mvpPlayerId,
        rating: parsed.data.mvpRating,
        penalty: parsed.data.mvpPenalty ?? 0,
        weight: 1,
        source: 'organizer'
      }
    });
  }

  await writeAuditLog({
    tournamentId: id,
    entityType: 'Match',
    entityId: matchId,
    action: 'RESULT_UPDATED',
    previousValue: match,
    newValue: parsed.data
  });

  return NextResponse.json({ ok: true });
}
