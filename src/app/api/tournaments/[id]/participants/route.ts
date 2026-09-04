import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const lines: string[] = body.participants ?? [];
  const created: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (tournament.participantType === 'TEAM') {
      const names = trimmed.split(/[\/\-,]/).map((n) => n.trim()).filter(Boolean);
      const playerRecords = [];
      for (const name of names) {
        const parts = name.split(/\s+/);
        const firstName = parts[0] ?? name;
        const lastName = parts.slice(1).join(' ') || '';
        const player = await prisma.player.create({
          data: { tournamentId: id, firstName, lastName }
        });
        playerRecords.push(player);
      }

      const team = await prisma.team.create({
        data: {
          tournamentId: id,
          name: trimmed,
          members: { create: playerRecords.map((p) => ({ playerId: p.id })) }
        }
      });

      await prisma.tournamentParticipant.create({
        data: {
          tournamentId: id,
          type: 'TEAM',
          displayName: trimmed,
          teamId: team.id
        }
      });
      created.push(trimmed);
    } else {
      const parts = trimmed.split(/\s+/);
      const firstName = parts[0] ?? trimmed;
      const lastName = parts.slice(1).join(' ') || '';

      const player = await prisma.player.create({
        data: { tournamentId: id, firstName, lastName }
      });

      await prisma.tournamentParticipant.create({
        data: {
          tournamentId: id,
          type: 'PLAYER',
          displayName: trimmed,
          playerId: player.id
        }
      });
      created.push(trimmed);
    }
  }

  return NextResponse.json({ created, count: created.length }, { status: 201 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const participantId = request.nextUrl.searchParams.get('participantId');

  if (!participantId) {
    return NextResponse.json({ error: 'participantId è obbligatorio.' }, { status: 400 });
  }

  const participant = await prisma.tournamentParticipant.findUnique({
    where: { id: participantId },
  });

  if (!participant || participant.tournamentId !== id) {
    return NextResponse.json({ error: 'Partecipante non trovato.' }, { status: 404 });
  }

  const matchCount = await prisma.match.count({
    where: {
      tournamentId: id,
      OR: [{ participantAId: participantId }, { participantBId: participantId }],
      status: { in: ['COMPLETED', 'WALKOVER', 'RETIRED'] },
    },
  });

  if (matchCount > 0) {
    return NextResponse.json({ error: 'Non puoi eliminare un partecipante con partite già giocate. Rigenera prima il calendario.' }, { status: 400 });
  }

  await prisma.match.deleteMany({
    where: {
      tournamentId: id,
      OR: [{ participantAId: participantId }, { participantBId: participantId }],
    },
  });

  if (participant.teamId) {
    const team = await prisma.team.findUnique({ where: { id: participant.teamId }, include: { members: true } });
    await prisma.tournamentParticipant.delete({ where: { id: participantId } });
    if (team) {
      await prisma.teamPlayer.deleteMany({ where: { teamId: team.id } });
      for (const member of team.members) {
        await prisma.player.delete({ where: { id: member.playerId } }).catch(() => {});
      }
      await prisma.team.delete({ where: { id: team.id } });
    }
  } else if (participant.playerId) {
    await prisma.tournamentParticipant.delete({ where: { id: participantId } });
    await prisma.player.delete({ where: { id: participant.playerId } }).catch(() => {});
  } else {
    await prisma.tournamentParticipant.delete({ where: { id: participantId } });
  }

  return NextResponse.json({ ok: true });
}
