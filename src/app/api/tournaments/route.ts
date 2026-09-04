import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { defaultMVPSettings, defaultTournamentRules } from '@/lib/domain/types';

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: { settings: true, _count: { select: { participants: true, matches: true } } }
  });
  return NextResponse.json({ tournaments });
}

export async function POST(request: Request) {
  const body = await request.json();
  let slug = String(body.slug ?? body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const existingSlug = await prisma.tournament.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  const organizer = await prisma.user.upsert({
    where: { email: body.organizerEmail ?? 'organizer@example.com' },
    update: {},
    create: { email: body.organizerEmail ?? 'organizer@example.com', name: body.organizerName ?? 'Organizzatore Demo', role: 'ORGANIZER' }
  });

  const participantType = body.participantType ?? 'TEAM';
  const participantLines: string[] = (body.participants as string[] | undefined) ?? [];

  const tournament = await prisma.tournament.create({
    data: {
      name: body.name,
      slug,
      description: body.description,
      format: body.format ?? 'ROUND_ROBIN',
      participantType,
      organizerId: organizer.id,
      settings: {
        create: {
          courtsCount: body.courtsCount ?? 2,
          setsPerMatch: body.setsPerMatch ?? defaultTournamentRules.setsPerMatch,
          gamesPerSet: body.gamesPerSet ?? defaultTournamentRules.gamesPerSet,
          matchDurationMinutes: body.matchDurationMinutes ?? 30,
          minRestMinutes: body.minRestMinutes ?? 15,
          maxMatchesPerPlayerDay: body.maxMatchesPerPlayerDay ?? 6,
          tieBreakEnabled: body.tieBreakEnabled ?? true,
          goldenPointEnabled: body.goldenPointEnabled ?? true,
          mvpEnabled: body.mvpEnabled ?? true,
          scoreRules: {
            ...defaultTournamentRules.points,
            win: body.pointsWin ?? defaultTournamentRules.points.win,
            loss: body.pointsLoss ?? defaultTournamentRules.points.loss,
          },
          mvpWeights: defaultMVPSettings,
          customRules: body.finalPhase ? { finalPhase: body.finalPhase, timeSlots: body.timeSlots } : (body.timeSlots ? { timeSlots: body.timeSlots } : undefined),
        }
      }
    },
    include: { settings: true }
  });

  if (participantLines.length > 0) {
    for (const line of participantLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (participantType === 'TEAM') {
        const names = trimmed.split(/[\/\-,]/).map((n) => n.trim()).filter(Boolean);
        const playerRecords = [];
        for (const name of names) {
          const parts = name.split(/\s+/);
          const firstName = parts[0] ?? name;
          const lastName = parts.slice(1).join(' ') || '';
          const player = await prisma.player.create({
            data: { tournamentId: tournament.id, firstName, lastName }
          });
          playerRecords.push(player);
        }

        const team = await prisma.team.create({
          data: {
            tournamentId: tournament.id,
            name: trimmed,
            members: { create: playerRecords.map((p) => ({ playerId: p.id })) }
          }
        });

        await prisma.tournamentParticipant.create({
          data: {
            tournamentId: tournament.id,
            type: 'TEAM',
            displayName: trimmed,
            teamId: team.id
          }
        });
      } else {
        const parts = trimmed.split(/\s+/);
        const firstName = parts[0] ?? trimmed;
        const lastName = parts.slice(1).join(' ') || '';

        const player = await prisma.player.create({
          data: { tournamentId: tournament.id, firstName, lastName }
        });

        await prisma.tournamentParticipant.create({
          data: {
            tournamentId: tournament.id,
            type: 'PLAYER',
            displayName: trimmed,
            playerId: player.id
          }
        });
      }
    }
  }

  const result = await prisma.tournament.findUnique({
    where: { id: tournament.id },
    include: { settings: true, _count: { select: { participants: true } } }
  });

  return NextResponse.json({ tournament: result }, { status: 201 });
}
