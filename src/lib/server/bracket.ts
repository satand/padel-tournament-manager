import { prisma } from './db';

type FinalMatch = {
  id: string;
  roundIndex: number;
  status: string;
  winnerId: string | null;
  participantAId: string | null;
  participantBId: string | null;
  parentMatchIdA: string | null;
  parentResultA: 'WINNER' | 'LOSER' | null;
  parentMatchIdB: string | null;
  parentResultB: 'WINNER' | 'LOSER' | null;
};

function sourceId(parent: FinalMatch | undefined, result: 'WINNER' | 'LOSER'): string | null {
  if (!parent) return null;
  if (!['COMPLETED', 'WALKOVER', 'RETIRED'].includes(parent.status)) return null;
  if (!parent.winnerId) return null;
  if (result === 'WINNER') return parent.winnerId;
  const a = parent.participantAId;
  const b = parent.participantBId;
  if (!a || !b) return null;
  return parent.winnerId === a ? b : a;
}

// Propaga in modo idempotente i vincenti (e i perdenti) nei tabelloni della fase finale.
// Va chiamata dopo ogni salvataggio di un risultato e dopo la generazione dei tabelloni.
export async function resolveBracket(tournamentId: string): Promise<void> {
  const finals = (await prisma.match.findMany({
    where: { tournamentId, phase: { not: 'group' } },
    orderBy: { roundIndex: 'asc' }
  })) as unknown as FinalMatch[];
  if (finals.length === 0) return;

  const byId = new Map(finals.map((m) => [m.id, m]));

  for (const m of finals) {
    const resolvedA = m.parentMatchIdA ? sourceId(byId.get(m.parentMatchIdA), m.parentResultA ?? 'WINNER') : m.participantAId;
    const resolvedB = m.parentMatchIdB ? sourceId(byId.get(m.parentMatchIdB), m.parentResultB ?? 'WINNER') : m.participantBId;
    if (resolvedA !== m.participantAId || resolvedB !== m.participantBId) {
      await prisma.match.update({ where: { id: m.id }, data: { participantAId: resolvedA, participantBId: resolvedB } });
      const local = byId.get(m.id);
      if (local) {
        local.participantAId = resolvedA;
        local.participantBId = resolvedB;
      }
    }
  }
}
