import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

function asInt(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const CALENDAR_FIELDS = ['courtsCount', 'matchDurationMinutes', 'minRestMinutes', 'maxMatchesPerPlayerDay'] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { settings: true } });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  if (!tournament.settings) return NextResponse.json({ error: 'Impostazioni non trovate.' }, { status: 404 });

  const data: Record<string, unknown> = {};
  let startsAt: Date | null | undefined; // undefined = campo non fornito

  for (const key of CALENDAR_FIELDS) {
    const value = asInt(body[key]);
    if (value != null) data[key] = value;
  }

  if (tournament.status === 'DRAFT') {
    const structuralInt = ['gamesPerSet', 'targetGames', 'groupCount', 'qualifiedPerGroup'];
    for (const key of structuralInt) {
      const value = asInt(body[key]);
      if (value != null) data[key] = value;
    }
    const maxSets = asInt(body.maxSets ?? body.setsPerMatch);
    if (maxSets != null) {
      data.maxSets = maxSets;
      data.setsPerMatch = maxSets;
    }
    const scoringMode = pickEnum(body.scoringMode, ['SETS', 'GAMES_TARGET', 'TIME'] as const);
    if (scoringMode) data.scoringMode = scoringMode;
    const finalStartRound = pickEnum(body.finalStartRound, ['R16', 'R8', 'QF', 'SF', 'FINAL'] as const);
    if (finalStartRound) data.finalStartRound = finalStartRound;
    const mvpThroughPhase = pickEnum(body.mvpThroughPhase, ['GROUP', 'R16', 'R8', 'QF', 'SF', 'FINAL'] as const);
    if (mvpThroughPhase) data.mvpThroughPhase = mvpThroughPhase;
    for (const key of ['splitGoldSilver', 'mvpEnabled', 'allowDraws'] as const) {
      if (typeof body[key] === 'boolean') data[key] = body[key];
    }
    if (Array.isArray(body.tierThresholds)) data.tierThresholds = body.tierThresholds.filter((t: unknown) => typeof t === 'number');

    if ('startsAt' in body) {
      const raw = body.startsAt;
      startsAt = typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : null;
    }
  }

  if (Object.keys(data).length === 0 && startsAt === undefined) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  let updated = 0;
  if (Object.keys(data).length > 0) {
    await prisma.tournamentSettings.update({ where: { tournamentId: id }, data });
    updated += Object.keys(data).length;
  }
  if (startsAt !== undefined) {
    await prisma.tournament.update({ where: { id }, data: { startsAt } });
    updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const tournament = await prisma.tournament.findFirst({ where: { OR: [{ id }, { slug: id }] } });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  await prisma.tournament.delete({ where: { id: tournament.id } });
  return NextResponse.json({ ok: true });
}
