import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });

  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  await prisma.tournament.delete({ where: { id: tournament.id } });

  return NextResponse.json({ ok: true });
}
