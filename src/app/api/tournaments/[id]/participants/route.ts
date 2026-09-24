import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { coupleSchema, couplesPayloadSchema } from '@/lib/domain/validators';
import { closedResponse } from '@/lib/server/guards';
import { composeTeamDisplayName, parsePlayerName, playerSurname } from '@/lib/domain/teams';

function roundLevel(level: number | undefined): number | null {
  if (level == null || Number.isNaN(level)) return null;
  return Math.round(level * 100) / 100;
}

async function matchCount(tournamentId: string): Promise<number> {
  return prisma.match.count({ where: { tournamentId } });
}

const ROSTER_LOCKED = 'Calendario già generato: l\'anagrafica squadre è bloccata. Crea un nuovo torneo per un elenco diverso.';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  const locked = closedResponse(tournament);
  if (locked) return locked;
  if ((await matchCount(id)) > 0) {
    return NextResponse.json({ error: ROSTER_LOCKED }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = couplesPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created: { id: string; displayName: string }[] = [];
  for (const couple of parsed.data.couples) {
    const p1 = parsePlayerName(couple.player1);
    const p2 = parsePlayerName(couple.player2);
    const displayName = composeTeamDisplayName([playerSurname(p1), playerSurname(p2)]) || 'Coppia';
    const level = roundLevel(couple.level);

    const playerA = await prisma.player.create({ data: { tournamentId: id, firstName: p1.firstName, lastName: p1.lastName } });
    const playerB = await prisma.player.create({ data: { tournamentId: id, firstName: p2.firstName, lastName: p2.lastName } });
    const team = await prisma.team.create({
      data: {
        tournamentId: id,
        name: displayName,
        members: { create: [{ playerId: playerA.id }, { playerId: playerB.id }] }
      }
    });
    const participant = await prisma.tournamentParticipant.create({
      data: { tournamentId: id, displayName, level, teamId: team.id }
    });
    created.push({ id: participant.id, displayName: participant.displayName });
  }

  return NextResponse.json({ created, count: created.length }, { status: 201 });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { status: true } });
  const locked = closedResponse(tournament);
  if (locked) return locked;
  const body = await request.json().catch(() => ({}));
  const participantId = typeof body.participantId === 'string' ? body.participantId : '';
  if (!participantId) return NextResponse.json({ error: 'participantId obbligatorio.' }, { status: 400 });

  const couple = coupleSchema.safeParse(body);
  if (!couple.success) return NextResponse.json({ error: couple.error.flatten() }, { status: 400 });

  const participant = await prisma.tournamentParticipant.findFirst({
    where: { id: participantId, tournamentId: id },
    include: { team: { include: { members: true } } }
  });
  if (!participant) return NextResponse.json({ error: 'Partecipante non trovato.' }, { status: 404 });

  if ((await matchCount(id)) > 0) {
    return NextResponse.json({ error: ROSTER_LOCKED }, { status: 400 });
  }

  const p1 = parsePlayerName(couple.data.player1);
  const p2 = parsePlayerName(couple.data.player2);
  const displayName = composeTeamDisplayName([playerSurname(p1), playerSurname(p2)]) || 'Coppia';
  const level = roundLevel(couple.data.level);

  const memberPlayerIds = participant.team.members.map((m) => m.playerId);
  const firstNameIds = memberPlayerIds.slice(0, 2);

  await prisma.player.update({ where: { id: firstNameIds[0] }, data: { firstName: p1.firstName, lastName: p1.lastName } }).catch(() => undefined);
  if (firstNameIds[1]) {
    await prisma.player.update({ where: { id: firstNameIds[1] }, data: { firstName: p2.firstName, lastName: p2.lastName } }).catch(() => undefined);
  } else {
    await prisma.player.create({ data: { tournamentId: id, firstName: p2.firstName, lastName: p2.lastName, teamMemberships: { create: { teamId: participant.teamId } } } });
  }

  await prisma.team.update({ where: { id: participant.teamId }, data: { name: displayName } });
  await prisma.tournamentParticipant.update({ where: { id: participantId }, data: { displayName, level } });

  return NextResponse.json({ ok: true, displayName });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { status: true } });
  const locked = closedResponse(tournament);
  if (locked) return locked;
  const participantId = request.nextUrl.searchParams.get('participantId');
  if (!participantId) return NextResponse.json({ error: 'participantId è obbligatorio.' }, { status: 400 });

  const participant = await prisma.tournamentParticipant.findFirst({ where: { id: participantId, tournamentId: id } });
  if (!participant) return NextResponse.json({ error: 'Partecipante non trovato.' }, { status: 404 });

  if ((await matchCount(id)) > 0) {
    return NextResponse.json({ error: ROSTER_LOCKED }, { status: 400 });
  }

  await prisma.match.deleteMany({ where: { tournamentId: id, OR: [{ participantAId: participantId }, { participantBId: participantId }] } });
  await prisma.tournamentParticipant.delete({ where: { id: participantId } });

  const team = await prisma.team.findUnique({ where: { id: participant.teamId }, include: { members: true } }).catch(() => null);
  if (team) {
    await prisma.teamPlayer.deleteMany({ where: { teamId: team.id } });
    for (const member of team.members) {
      await prisma.player.delete({ where: { id: member.playerId } }).catch(() => undefined);
    }
    await prisma.team.delete({ where: { id: team.id } }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
