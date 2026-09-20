import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { buildRules } from '@/lib/server/serialize';
import { resolveBracket } from '@/lib/server/bracket';
import { buildFinalBracket, type FinalSlot } from '@/lib/domain/scheduler';
import { calculateRanking } from '@/lib/domain/ranking';
import type { Match as DomainMatch, Participant } from '@/lib/domain/types';

const finalsPredicate = { phase: { not: 'group' } } as const;

function slotParticipant(slot: FinalSlot): string | null {
  return slot.kind === 'participant' ? slot.participantId : null;
}
function slotParent(slot: FinalSlot): { result: 'WINNER' | 'LOSER' } | null {
  if (slot.kind === 'winner') return { result: 'WINNER' };
  if (slot.kind === 'loser') return { result: 'LOSER' };
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const regenerate = body.regenerate === true;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      settings: true,
      groups: { orderBy: { sortOrder: 'asc' } },
      participants: true,
      matches: { where: { phase: 'group' }, include: { sets: true } }
    }
  });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  if (tournament.groups.length === 0) return NextResponse.json({ error: 'Genera prima la fase a gironi.' }, { status: 400 });

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

  const rules = buildRules(tournament.settings);
  const qualifiedPerGroup = tournament.settings?.qualifiedPerGroup ?? 2;
  const split = tournament.settings?.splitGoldSilver ?? false;

  const domainParticipants: Participant[] = tournament.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    type: 'TEAM',
    playerIds: [],
    level: p.level ?? undefined,
    seed: p.seed ?? undefined,
    isWithdrawn: p.isWithdrawn,
    groupId: p.groupId ?? undefined
  }));
  const byId = new Map(domainParticipants.map((p) => [p.id, p]));

  type Qualified = { id: string; level: number; rank: number };
  const qualified: Qualified[] = [];
  for (const group of tournament.groups) {
    const gp = domainParticipants.filter((p) => p.groupId === group.id);
    const gm: DomainMatch[] = tournament.matches.filter((m) => m.groupId === group.id).map((m) => ({
      id: m.id,
      participantAId: m.participantAId,
      participantBId: m.participantBId,
      status: m.status as DomainMatch['status'],
      sets: m.sets.map((s) => ({ setNumber: s.setNumber, gamesA: s.gamesA, gamesB: s.gamesB }))
    }));
    const table = calculateRanking(gp, gm, rules);
    table.slice(0, qualifiedPerGroup).forEach((row, idx) => {
      const p = byId.get(row.participantId);
      if (p) qualified.push({ id: p.id, level: p.level ?? 0, rank: idx + 1 });
    });
  }

  const gold: Qualified[] = [];
  const silver: Qualified[] = [];
  const single: Qualified[] = [];
  if (split && qualifiedPerGroup >= 2) {
    for (const q of qualified) (q.rank === 1 ? gold : silver).push(q);
  } else {
    single.push(...qualified);
  }

  const seedSort = (arr: Qualified[]) => [...arr].sort((a, b) => a.rank - b.rank || b.level - a.level);

  let created = 0;
  const createBracket = async (arr: Qualified[], bracket: 'GOLD' | 'SILVER' | null) => {
    const ordered = seedSort(arr);
    if (ordered.length < 2) return;
    const entrants = ordered.map((q) => byId.get(q.id)!).filter(Boolean);
    const bm = buildFinalBracket(entrants, bracket);
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

  if (split && qualifiedPerGroup >= 2) {
    await createBracket(gold, 'GOLD');
    await createBracket(silver, 'SILVER');
  } else {
    await createBracket(single, null);
  }

  await resolveBracket(id);

  if (tournament.status === 'DRAFT' || tournament.status === 'READY') {
    await prisma.tournament.update({ where: { id }, data: { status: 'RUNNING' } });
  }

  return NextResponse.json({
    ok: true,
    matchesCreated: created,
    goldEntrants: split && qualifiedPerGroup >= 2 ? gold.length : 0,
    silverEntrants: split && qualifiedPerGroup >= 2 ? silver.length : 0,
    singleEntrants: split && qualifiedPerGroup >= 2 ? 0 : single.length
  }, { status: 201 });
}
