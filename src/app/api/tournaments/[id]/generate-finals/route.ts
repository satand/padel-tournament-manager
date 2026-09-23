import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext } from '@/lib/server/serialize';
import { resolveBracket } from '@/lib/server/bracket';
import { buildFinalBracket, type FinalSlot } from '@/lib/domain/scheduler';
import { bracketSizeFor, orderQualifiers, splitGoldSilver, type ComparableQualified, type FinalRound } from '@/lib/domain/finals';
import { sumMvpRatingByParticipant } from '@/lib/domain/mvp';
import { calculateRanking } from '@/lib/domain/ranking';

const finalsPredicate = { phase: { not: 'group' } } as const;

function slotParticipant(slot: FinalSlot): string | null {
  return slot.kind === 'participant' ? slot.participantId : null;
}
function slotParent(slot: FinalSlot): { result: 'WINNER' | 'LOSER' } | null {
  if (slot.kind === 'winner') return { result: 'WINNER' };
  if (slot.kind === 'loser') return { result: 'LOSER' };
  return null;
}

function asRound(v: string | null | undefined): FinalRound | null {
  return v === 'R16' || v === 'R8' || v === 'QF' || v === 'SF' || v === 'FINAL' ? v : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const regenerate = body.regenerate === true;

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: tournamentInclude });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const ctx = toDomainContext(tournament);
  if (ctx.groups.length === 0) return NextResponse.json({ error: 'Genera prima la fase a gironi.' }, { status: 400 });

  const groupMatches = ctx.matches.filter((m) => m.groupId != null);
  const groupDone = groupMatches.length > 0 && groupMatches.every((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status));
  if (!groupDone) {
    return NextResponse.json({ error: 'La fase finale si configura al termine della fase a gironi.' }, { status: 400 });
  }

  const existingFinals = await prisma.match.count({ where: { tournamentId: id, ...finalsPredicate } });
  if (existingFinals > 0 && !regenerate) {
    return NextResponse.json({ error: 'Fase finale già generata. Usa rigenera per ricrearla.' }, { status: 400 });
  }
  if (existingFinals > 0 && regenerate) {
    await prisma.matchSet.deleteMany({ where: { match: { tournamentId: id, ...finalsPredicate } } });
    await prisma.matchResult.deleteMany({ where: { match: { tournamentId: id, ...finalsPredicate } } });
    await prisma.mVPVote.deleteMany({ where: { match: { tournamentId: id, ...finalsPredicate } } });
    await prisma.match.deleteMany({ where: { tournamentId: id, ...finalsPredicate } });
  }

  const rules = ctx.rules;
  const settings = tournament.settings;
  const qualifiedPerGroup = settings?.qualifiedPerGroup ?? 2;
  const split = settings?.splitGoldSilver ?? false;

  // Somma MVP (media voto per giocatore, sommata sui due componenti) sui voti dei soli gironi.
  const groupMatchIds = new Set(groupMatches.map((m) => m.id));
  const groupVotes = ctx.mvpVotes.filter((v) => groupMatchIds.has(v.matchId));
  const mvpSum = sumMvpRatingByParticipant(ctx.participants, groupVotes);

  // Pool dei qualificati: top "qualifiedPerGroup" per girone (ordinamento interno del girone invariato).
  const pool: ComparableQualified[] = [];
  for (const group of ctx.groups) {
    const gp = ctx.participants.filter((p) => p.groupId === group.id && !p.isWithdrawn);
    const gm = groupMatches.filter((m) => m.groupId === group.id);
    const table = calculateRanking(gp, gm, rules);
    for (const row of table.slice(0, qualifiedPerGroup)) {
      pool.push({
        id: row.participantId,
        displayName: row.displayName,
        points: row.points,
        gameDiff: row.gameDiff,
        mvpSum: mvpSum[row.participantId] ?? 0
      });
    }
  }

  // Ranking globale cross-girone: punti -> differenza game -> somma MVP -> nome.
  const ordered = orderQualifiers(pool);

  const byId = new Map(ctx.participants.map((p) => [p.id, p]));
  let gold: ComparableQualified[] = [];
  let silver: ComparableQualified[] = [];
  let single: ComparableQualified[] = [];
  if (split && ordered.length >= 4) {
    ({ gold, silver } = splitGoldSilver(ordered, settings?.qualifiedForGold));
  } else {
    single = ordered;
  }

  let created = 0;
  const createBracket = async (arr: ComparableQualified[], bracket: 'GOLD' | 'SILVER' | null, round: FinalRound | null) => {
    if (arr.length < 2) return;
    const entrants = arr.map((q) => byId.get(q.id)!).filter(Boolean);
    const size = bracketSizeFor(entrants.length, round);
    const bm = buildFinalBracket(entrants, bracket, size);
    const keyToId = new Map<string, string>();
    for (const m of bm) {
      const parentA = slotParent(m.a);
      const parentB = slotParent(m.b);
      const createdMatch = await prisma.match.create({
        data: {
          tournamentId: id,
          participantAId: slotParticipant(m.a),
          participantBId: slotParticipant(m.b),
          status: m.status,
          winnerId: m.winnerId ?? null,
          groupId: null,
          phase: m.phase,
          phaseWeight: m.phaseWeight,
          roundIndex: m.roundIndex,
          bracket: m.bracket,
          parentMatchIdA: parentA ? keyToId.get(m.a.kind === 'winner' || m.a.kind === 'loser' ? m.a.matchKey : '') ?? null : null,
          parentResultA: parentA?.result ?? null,
          parentMatchIdB: parentB ? keyToId.get(m.b.kind === 'winner' || m.b.kind === 'loser' ? m.b.matchKey : '') ?? null : null,
          parentResultB: parentB?.result ?? null
        }
      });
      keyToId.set(m.key, createdMatch.id);
      created += 1;
    }
  };

  if (gold.length >= 2 || silver.length >= 2) {
    await createBracket(gold, 'GOLD', asRound(settings?.finalStartRoundGold));
    await createBracket(silver, 'SILVER', asRound(settings?.finalStartRoundSilver));
  } else {
    await createBracket(single, null, asRound(settings?.finalStartRound));
  }

  await resolveBracket(id);

  if (tournament.status === 'DRAFT' || tournament.status === 'READY') {
    await prisma.tournament.update({ where: { id }, data: { status: 'RUNNING' } });
  }

  return NextResponse.json({
    ok: true,
    matchesCreated: created,
    qualified: ordered.length,
    goldEntrants: gold.length,
    silverEntrants: silver.length,
    singleEntrants: single.length
  }, { status: 201 });
}
