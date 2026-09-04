import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { generateRoundRobinMatches, generateKnockoutBracket, generateAmericanoRounds, assignSchedule } from '@/lib/domain/scheduler';
import type { Participant } from '@/lib/domain/types';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const regenerate = body.regenerate === true;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      settings: true,
      participants: true,
      courts: { orderBy: { order: 'asc' } },
      matches: { select: { id: true } },
    },
  });

  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  if (tournament.participants.length < 2) return NextResponse.json({ error: 'Servono almeno 2 partecipanti per generare il calendario.' }, { status: 400 });

  if (tournament.matches.length > 0 && !regenerate) {
    return NextResponse.json({ error: 'Il calendario è già stato generato. Usa l\'opzione rigenera per ricrearlo.' }, { status: 400 });
  }

  if (tournament.matches.length > 0 && regenerate) {
    await prisma.matchSet.deleteMany({ where: { match: { tournamentId: id } } });
    await prisma.matchResult.deleteMany({ where: { match: { tournamentId: id } } });
    await prisma.mVPVote.deleteMany({ where: { tournamentId: id } });
    await prisma.match.deleteMany({ where: { tournamentId: id } });
  }

  const participants: Participant[] = tournament.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    type: p.type as 'PLAYER' | 'TEAM',
    playerIds: p.playerId ? [p.playerId] : [],
    seed: p.seed ?? undefined,
    isWithdrawn: p.isWithdrawn,
  }));

  let generatedMatches;
  const format = tournament.format;

  if (format === 'KNOCKOUT') {
    generatedMatches = generateKnockoutBracket(participants);
  } else if (format === 'AMERICANO') {
    const rounds = Math.max(3, participants.length - 1);
    generatedMatches = generateAmericanoRounds(participants, rounds);
  } else {
    generatedMatches = generateRoundRobinMatches(participants);
  }

  let courts = tournament.courts;
  if (courts.length === 0) {
    const courtsCount = tournament.settings?.courtsCount ?? 2;
    const created = [];
    for (let i = 1; i <= courtsCount; i++) {
      const court = await prisma.court.create({
        data: { tournamentId: id, name: `Campo ${i}`, order: i }
      });
      created.push(court);
    }
    courts = created;
  }

  const scheduledMatches = assignSchedule(generatedMatches, {
    participants,
    courts: courts.map((c) => ({ id: c.id, name: c.name, order: c.order })),
    startsAt: tournament.startsAt?.toISOString() ?? new Date().toISOString(),
    matchDurationMinutes: tournament.settings?.matchDurationMinutes ?? 30,
    minRestMinutes: tournament.settings?.minRestMinutes ?? 15,
    maxMatchesPerPlayerDay: tournament.settings?.maxMatchesPerPlayerDay ?? 6,
  });

  for (const match of scheduledMatches) {
    await prisma.match.create({
      data: {
        tournamentId: id,
        participantAId: match.participantAId,
        participantBId: match.participantBId,
        status: match.status,
        winnerId: match.winnerId ?? null,
        courtId: match.courtId ?? null,
        scheduledAt: match.scheduledAt ? new Date(match.scheduledAt) : null,
        roundIndex: match.roundIndex ?? 1,
        phase: match.phase ?? 'group',
        phaseWeight: match.phaseWeight ?? 1,
      },
    });
  }

  if (tournament.status === 'DRAFT') {
    await prisma.tournament.update({ where: { id }, data: { status: 'READY' } });
  }

  return NextResponse.json({ matchesCreated: scheduledMatches.length }, { status: 201 });
}
