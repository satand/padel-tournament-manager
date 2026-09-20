import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

function asInt(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : undefined;
}

const CALENDAR_FIELDS = ['courtsCount', 'matchDurationMinutes', 'minRestMinutes', 'maxMatchesPerPlayerDay'] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { settings: true } });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  if (!tournament.settings) return NextResponse.json({ error: 'Impostazioni non trovate.' }, { status: 404 });

  const data: Record<string, unknown> = {};

  for (const key of CALENDAR_FIELDS) {
    const value = asInt(body[key]);
    if (value != null) data[key] = value;
  }

  if (tournament.status === 'DRAFT') {
    const structuralInt = ['setsPerMatch', 'gamesPerSet', 'targetGames', 'groupCount', 'qualifiedPerGroup'];
    for (const key of structuralInt) {
      const value = asInt(body[key]);
      if (value != null) data[key] = value;
    }
    if (Array.isArray(body.tierThresholds)) data.tierThresholds = body.tierThresholds.filter((t: unknown) => typeof t === 'number');
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true, updated: 0 });

  await prisma.tournamentSettings.update({ where: { tournamentId: id }, data });
  return NextResponse.json({ ok: true, updated: Object.keys(data).length });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const tournament = await prisma.tournament.findFirst({ where: { OR: [{ id }, { slug: id }] } });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  await prisma.tournament.delete({ where: { id: tournament.id } });
  return NextResponse.json({ ok: true });
}
