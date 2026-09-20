import { PrismaClient } from '@prisma/client';
import { defaultMVPSettings, defaultTournamentRules } from '../src/lib/domain/types';
import { demoMatches, demoParticipants, demoPlayers } from '../src/lib/demo/demo-data';

const prisma = new PrismaClient();

async function main() {
  const organizer = await prisma.user.upsert({
    where: { email: 'operatore@locale' },
    update: {},
    create: { email: 'operatore@locale', name: 'Operatore', role: 'ORGANIZER' }
  });

  const tournament = await prisma.tournament.upsert({
    where: { slug: 'luxury-padel-demo-open' },
    update: {},
    create: {
      name: 'Luxury Padel Demo Open',
      slug: 'luxury-padel-demo-open',
      description: 'Torneo demo con coppie fisse, round robin e MVP.',
      format: 'ROUND_ROBIN',
      organizerId: organizer.id,
      status: 'RUNNING',
      settings: {
        create: {
          courtsCount: 2,
          matchDurationMinutes: 30,
          minRestMinutes: 10,
          setsPerMatch: 1,
          gamesPerSet: 6,
          tieBreakEnabled: true,
          goldenPointEnabled: true,
          mvpEnabled: true,
          scoreRules: defaultTournamentRules.points,
          mvpWeights: defaultMVPSettings
        }
      },
      courts: {
        create: [
          { name: 'Campo 1', order: 1 },
          { name: 'Campo 2', order: 2 }
        ]
      }
    }
  });

  await prisma.player.deleteMany({ where: { tournamentId: tournament.id } });
  await prisma.team.deleteMany({ where: { tournamentId: tournament.id } });
  await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: tournament.id } });
  await prisma.match.deleteMany({ where: { tournamentId: tournament.id } });

  const playerIdMap = new Map<string, string>();
  for (const player of demoPlayers) {
    const created = await prisma.player.create({
      data: {
        tournamentId: tournament.id,
        firstName: player.firstName,
        lastName: player.lastName,
        nickname: player.nickname
      }
    });
    playerIdMap.set(player.id, created.id);
  }

  const participantIdMap = new Map<string, string>();
  for (const participant of demoParticipants) {
    const team = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        name: participant.displayName,
        seed: participant.seed,
        members: { create: participant.playerIds.map((playerId) => ({ playerId: playerIdMap.get(playerId)! })) }
      }
    });
    const createdParticipant = await prisma.tournamentParticipant.create({
      data: {
        tournamentId: tournament.id,
        displayName: participant.displayName,
        level: undefined,
        teamId: team.id,
        seed: participant.seed,
        initialRank: participant.manualOrder
      }
    });
    participantIdMap.set(participant.id, createdParticipant.id);
  }

  const court1 = await prisma.court.findFirstOrThrow({ where: { tournamentId: tournament.id, order: 1 } });
  const court2 = await prisma.court.findFirstOrThrow({ where: { tournamentId: tournament.id, order: 2 } });

  for (const match of demoMatches) {
    const createdMatch = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        participantAId: participantIdMap.get(match.participantAId)!,
        participantBId: participantIdMap.get(match.participantBId)!,
        status: match.status,
        phase: match.phase ?? 'group',
        roundIndex: match.roundIndex ?? 1,
        phaseWeight: match.phaseWeight ?? 1,
        scheduledAt: match.scheduledAt ? new Date(match.scheduledAt) : undefined,
        courtId: match.courtId === 'court-1' ? court1.id : court2.id,
        sets: { create: match.sets.map((set) => ({ ...set })) }
      }
    });

    if (match.sets.length > 0) {
      await prisma.matchResult.create({
        data: { matchId: createdMatch.id, status: match.status, completedAt: new Date(), rawScore: { sets: match.sets } }
      });
    }
  }

  console.log(`Seed completato: ${tournament.name} (${tournament.id})`);
}

main().finally(async () => prisma.$disconnect());
