import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

const DONE = ['COMPLETED', 'WALKOVER', 'RETIRED'] as const;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, status: true, _count: { select: { matches: true } } }
  });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });
  if (tournament.status === 'COMPLETED' || tournament.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Torneo già chiuso.' }, { status: 409 });
  }
  if (tournament._count.matches === 0) {
    return NextResponse.json({ error: 'Nessuna partita: genera il calendario prima di chiudere il torneo.' }, { status: 400 });
  }
  const open = await prisma.match.count({ where: { tournamentId: id, status: { notIn: [...DONE] } } });
  if (open > 0) {
    return NextResponse.json({ error: `Ci sono ancora ${open} partite da concludere prima di chiudere il torneo.` }, { status: 400 });
  }
  await prisma.tournament.update({ where: { id }, data: { status: 'COMPLETED' } });
  return NextResponse.json({ ok: true, status: 'COMPLETED' }, { status: 200 });
}
