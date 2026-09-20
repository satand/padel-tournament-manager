import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/db';
import { defaultMVPSettings, defaultTournamentRules } from '@/lib/domain/types';

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: { settings: true, _count: { select: { participants: true, matches: true } } }
  });
  return NextResponse.json({ tournaments });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Il nome del torneo è obbligatorio.' }, { status: 400 });

  let slug = String(body.slug ?? name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!slug) slug = 'torneo';
  const existingSlug = await prisma.tournament.findUnique({ where: { slug } });
  if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`;

  const organizer = await prisma.user.upsert({
    where: { email: 'operatore@locale' },
    update: {},
    create: { email: 'operatore@locale', name: 'Operatore', role: 'ORGANIZER' }
  });

  const format = pick(body.format, ['ROUND_ROBIN', 'GROUPS_PLUS_FINALS'] as const, 'GROUPS_PLUS_FINALS');
  const scoringMode = pick(body.scoringMode, ['SETS', 'GAMES_TARGET', 'TIME'] as const, 'SETS');
  const finalStartRound = pick(body.finalStartRound, ['R16', 'R8', 'QF', 'SF', 'FINAL'] as const, 'FINAL');
  const mvpThroughPhase = pick(body.mvpThroughPhase, ['GROUP', 'R16', 'R8', 'QF', 'SF', 'FINAL'] as const, 'FINAL');

  const tierThresholds = Array.isArray(body.tierThresholds) ? body.tierThresholds.filter((t: unknown) => typeof t === 'number') : null;

  const tournament = await prisma.tournament.create({
    data: {
      name,
      slug,
      description: body.description ?? null,
      format,
      status: 'DRAFT',
      organizerId: organizer.id,
      startsAt: typeof body.startsAt === 'string' && !Number.isNaN(Date.parse(body.startsAt)) ? new Date(body.startsAt) : null,
      settings: {
        create: {
          courtsCount: num(body.courtsCount, 2),
          setsPerMatch: num(body.setsPerMatch ?? body.maxSets, defaultTournamentRules.setsPerMatch),
          maxSets: num(body.setsPerMatch ?? body.maxSets, defaultTournamentRules.setsPerMatch),
          gamesPerSet: num(body.gamesPerSet, defaultTournamentRules.gamesPerSet),
          scoringMode,
          targetGames: body.targetGames != null ? num(body.targetGames, 0) : null,
          matchDurationMinutes: num(body.matchDurationMinutes, 30),
          minRestMinutes: num(body.minRestMinutes, 15),
          maxMatchesPerPlayerDay: num(body.maxMatchesPerPlayerDay, 6),
          groupCount: body.groupCount != null ? num(body.groupCount, 1) : null,
          qualifiedPerGroup: num(body.qualifiedPerGroup, 2),
          finalStartRound,
          splitGoldSilver: Boolean(body.splitGoldSilver),
          mvpThroughPhase,
          tierThresholds: tierThresholds && tierThresholds.length ? (tierThresholds as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          allowDraws: Boolean(body.allowDraws ?? defaultTournamentRules.allowDraws),
          tieBreakEnabled: body.tieBreakEnabled ?? true,
          goldenPointEnabled: body.goldenPointEnabled ?? true,
          mvpEnabled: body.mvpEnabled ?? true,
          scoreRules: {
            ...defaultTournamentRules.points,
            win: num(body.pointsWin, defaultTournamentRules.points.win),
            loss: num(body.pointsLoss, defaultTournamentRules.points.loss)
          },
          mvpWeights: defaultMVPSettings,
          customRules: body.timeSlots ? { timeSlots: body.timeSlots } : Prisma.DbNull
        }
      }
    },
    include: { settings: true }
  });

  return NextResponse.json({ tournament }, { status: 201 });
}
