import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { buildRules } from '@/lib/server/serialize';
import { resolveBracket } from '@/lib/server/bracket';
import { writeAuditLog } from '@/lib/server/audit';
import { randomizeMatches, loadParticipantPlayers } from '@/lib/server/randomResults';
import { closedResponse } from '@/lib/server/guards';
import type { MvpThrough } from '@/lib/domain/mvp';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { settings: true } });
  if (!tournament?.settings) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  const locked = closedResponse(tournament);
  if (locked) return locked;

  const rules = buildRules(tournament.settings);
  const mvpEnabled = Boolean(tournament.settings.mvpEnabled);
  const through = (tournament.settings.mvpThroughPhase ?? 'FINAL') as MvpThrough;

  const pendingRaw = await prisma.match.findMany({
    where: {
      tournamentId: id,
      phase: { not: 'group' },
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      participantAId: { not: null },
      participantBId: { not: null }
    }
  });

  // Solo partite di fase finale con entrambi i partecipanti già definiti ("giro corrente").
  const pending = pendingRaw
    .filter((m) => !!m.phase && m.phase !== 'group')
    .map((m) => ({ id: m.id, participantAId: m.participantAId as string, participantBId: m.participantBId as string, phase: m.phase }));

  if (pending.length === 0) return NextResponse.json({ ok: true, filled: 0, skipped: 0 });

  const playersMap = mvpEnabled ? await loadParticipantPlayers(id) : new Map<string, string[]>();

  const { filled, skipped } = await randomizeMatches({ tournamentId: id, rules, playersMap, mvpEnabled, through, matches: pending });

  // Propaga i vincitori nei turni successivi (che restano da giocare).
  await resolveBracket(id);

  await writeAuditLog({
    tournamentId: id,
    entityType: 'Match',
    entityId: id,
    action: 'RESULTS_RANDOMIZED_FINAL',
    newValue: { filled, skipped }
  });

  return NextResponse.json({ ok: true, filled, skipped });
}
