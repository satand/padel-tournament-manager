import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { generateRoundRobinMatches, assignSchedule } from '@/lib/domain/scheduler';
import { generateBalancedGroups, defaultGroupNames } from '@/lib/domain/draw';
import type { Match as DomainMatch, Participant } from '@/lib/domain/types';

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
      matches: { select: { id: true } }
    }
  });

  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  if (tournament.participants.length < 2) return NextResponse.json({ error: 'Servono almeno 2 coppie per generare il calendario.' }, { status: 400 });

  if (tournament.matches.length > 0 && !regenerate) {
    return NextResponse.json({ error: 'Il calendario è già stato generato. Usa l\'opzione rigenera per ricrearlo.' }, { status: 400 });
  }

  if (tournament.matches.length > 0 && regenerate) {
    await prisma.matchSet.deleteMany({ where: { match: { tournamentId: id } } });
    await prisma.matchResult.deleteMany({ where: { match: { tournamentId: id } } });
    await prisma.mVPVote.deleteMany({ where: { tournamentId: id } });
    await prisma.match.deleteMany({ where: { tournamentId: id } });
    await prisma.tournamentParticipant.updateMany({ where: { tournamentId: id }, data: { groupId: null } });
    await prisma.tournamentGroup.deleteMany({ where: { tournamentId: id } });
  }

  const domainParticipants: Participant[] = tournament.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    type: 'TEAM',
    level: p.level ?? undefined,
    playerIds: [],
    seed: p.seed ?? undefined,
    isWithdrawn: p.isWithdrawn
  }));

  const desiredGroups = tournament.settings?.groupCount ?? (tournament.format === 'GROUPS_PLUS_FINALS' ? 2 : 1);
  const activeCount = domainParticipants.filter((p) => !p.isWithdrawn).length;
  const groupCount = Math.min(Math.max(1, desiredGroups), Math.max(1, Math.floor(activeCount / 2)));

  const buckets = generateBalancedGroups(domainParticipants, groupCount).filter((bucket) => bucket.length >= 1);
  const names = defaultGroupNames(buckets.length);

  const groupRows = [];
  for (let i = 0; i < buckets.length; i += 1) {
    const group = await prisma.tournamentGroup.create({
      data: { tournamentId: id, name: names[i], sortOrder: i }
    });
    groupRows.push(group);
    const ids = buckets[i].map((p) => p.id);
    await prisma.tournamentParticipant.updateMany({ where: { id: { in: ids } }, data: { groupId: group.id } });
  }

  let generatedMatches: DomainMatch[] = [];
  for (const group of groupRows) {
    const groupParticipants = domainParticipants.filter((p) => buckets[group.sortOrder]?.some((b) => b.id === p.id));
    generatedMatches = generatedMatches.concat(generateRoundRobinMatches(groupParticipants, group.id));
  }

  let courts = tournament.courts;
  if (courts.length === 0) {
    const courtsCount = tournament.settings?.courtsCount ?? 2;
    const created = [];
    for (let i = 1; i <= courtsCount; i += 1) {
      const court = await prisma.court.create({ data: { tournamentId: id, name: `Campo ${i}`, order: i } });
      created.push(court);
    }
    courts = created;
  }

  const scheduledMatches = assignSchedule(generatedMatches, {
    participants: domainParticipants,
    courts: courts.map((c) => ({ id: c.id, name: c.name, order: c.order })),
    startsAt: tournament.startsAt?.toISOString() ?? new Date().toISOString(),
    warmUpMinutes: tournament.settings?.warmUpMinutes ?? 5,
    matchDurationMinutes: tournament.settings?.matchDurationMinutes ?? 30,
    changeoverMinutes: tournament.settings?.changeoverMinutes ?? 15,
    maxMatchesPerPlayerDay: tournament.settings ? tournament.settings.maxMatchesPerPlayerDay : 6
  });

  for (const match of scheduledMatches) {
    await prisma.match.create({
      data: {
        tournamentId: id,
        participantAId: match.participantAId,
        participantBId: match.participantBId,
        groupId: match.groupId ?? null,
        status: match.status,
        winnerId: match.winnerId ?? null,
        courtId: match.courtId ?? null,
        scheduledAt: match.scheduledAt ? new Date(match.scheduledAt) : null,
        roundIndex: match.roundIndex ?? 1,
        phase: match.phase ?? 'group',
        phaseWeight: match.phaseWeight ?? 1
      }
    });
  }

  if (tournament.status === 'DRAFT') {
    await prisma.tournament.update({ where: { id }, data: { status: 'READY' } });
  }

  return NextResponse.json({ matchesCreated: scheduledMatches.length, groupsCreated: groupRows.length }, { status: 201 });
}
