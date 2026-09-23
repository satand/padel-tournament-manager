import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { closedResponse } from '@/lib/server/guards';

function asInt(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const CALENDAR_FIELDS = ['courtsCount', 'warmUpMinutes', 'matchDurationMinutes', 'changeoverMinutes'] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { settings: true } });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  if (!tournament.settings) return NextResponse.json({ error: 'Impostazioni non trovate.' }, { status: 404 });
  const locked = closedResponse(tournament);
  if (locked) return locked;

  // La fase finale e' configurabile solo a gironi conclusi e prima di generare i tabelloni.
  const phaseStatus = await prisma.match.findMany({ where: { tournamentId: id }, select: { phase: true, status: true } });
  const groupPhase = phaseStatus.filter((m) => m.phase === 'group');
  const groupDone = groupPhase.length > 0 && groupPhase.every((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status));
  const finalsCount = phaseStatus.filter((m) => m.phase !== 'group').length;
  const finalsEditable = groupDone && finalsCount === 0;

  const data: Record<string, unknown> = {};
  let startsAt: Date | null | undefined; // undefined = campo non fornito

  for (const key of CALENDAR_FIELDS) {
    const value = asInt(body[key]);
    if (value != null) data[key] = value;
  }

  // Max partite/giorno: ammette null = nessun limite ("senza limite").
  if ('maxMatchesPerPlayerDay' in body) {
    const v = body.maxMatchesPerPlayerDay;
    if (v === null) data.maxMatchesPerPlayerDay = null;
    else {
      const i = asInt(v);
      if (i != null) data.maxMatchesPerPlayerDay = i;
    }
  }

  // Presentazione: tempo di cambio slide del carosello, modificabile in ogni stato.
  const projSec = asInt(body.presentSlideSeconds);
  if (projSec != null) data.presentSlideSeconds = Math.min(120, Math.max(2, projSec));

  if (tournament.status === 'DRAFT') {
    // Girone: solo "A target" o "A tempo" (il target è `targetGames`).
    const structuralInt = ['targetGames', 'groupCount', 'qualifiedPerGroup'];
    for (const key of structuralInt) {
      const value = asInt(body[key]);
      if (value != null) data[key] = value;
    }
    const scoringMode = pickEnum(body.scoringMode, ['GAMES_TARGET', 'TIME'] as const);
    if (scoringMode) data.scoringMode = scoringMode;

    const mvpThroughPhase = pickEnum(body.mvpThroughPhase, ['GROUP', 'R16', 'R8', 'QF', 'SF', 'FINAL'] as const);
    if (mvpThroughPhase) data.mvpThroughPhase = mvpThroughPhase;
    for (const key of ['mvpEnabled', 'allowDraws'] as const) {
      if (typeof body[key] === 'boolean') data[key] = body[key];
    }

    // Punti classifica: aggiorna solo win/loss preservando gli altri campi di scoreRules.
    const pointsWin = asInt(body.pointsWin);
    const pointsLoss = asInt(body.pointsLoss);
    if (pointsWin != null || pointsLoss != null) {
      const current = (tournament.settings?.scoreRules ?? {}) as Record<string, unknown>;
      const next = { ...current };
      if (pointsWin != null) next.win = pointsWin;
      if (pointsLoss != null) next.loss = pointsLoss;
      data.scoreRules = next;
    }

    if ('startsAt' in body) {
      const raw = body.startsAt;
      startsAt = typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : null;
    }
  }

  // Fase finale: configurabile solo a gironi conclusi e prima di generare i tabelloni.
  if (finalsEditable) {
    if ('finalScoringMode' in body) {
      const finalMode = pickEnum(body.finalScoringMode, ['SETS', 'GAMES_TARGET', 'TIME'] as const);
      data.finalScoringMode = finalMode ?? null;
      if (!finalMode) {
        data.finalSetsPerMatch = null;
        data.finalGamesPerSet = null;
        data.finalTargetGames = null;
      }
    }
    const finalSets = asInt(body.finalSetsPerMatch ?? body.finalMaxSets);
    if (finalSets != null) data.finalSetsPerMatch = finalSets;
    const finalGamesPerSet = asInt(body.finalGamesPerSet);
    if (finalGamesPerSet != null) data.finalGamesPerSet = finalGamesPerSet;
    const finalTargetGames = asInt(body.finalTargetGames);
    if (finalTargetGames != null) data.finalTargetGames = finalTargetGames;

    if (typeof body.splitGoldSilver === 'boolean') data.splitGoldSilver = body.splitGoldSilver;

    const FINAL_ROUNDS = ['R16', 'R8', 'QF', 'SF', 'FINAL'] as const;
    const finalStartRound = pickEnum(body.finalStartRound, FINAL_ROUNDS);
    if (finalStartRound) data.finalStartRound = finalStartRound;
    if ('finalStartRoundGold' in body) {
      data.finalStartRoundGold = pickEnum(body.finalStartRoundGold, FINAL_ROUNDS) ?? null;
    }
    if ('finalStartRoundSilver' in body) {
      data.finalStartRoundSilver = pickEnum(body.finalStartRoundSilver, FINAL_ROUNDS) ?? null;
    }
    if ('qualifiedForGold' in body) {
      const q = asInt(body.qualifiedForGold);
      data.qualifiedForGold = q != null ? Math.max(2, q) : null;
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
