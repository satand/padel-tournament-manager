import { notFound } from 'next/navigation';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, type TournamentContext } from '@/lib/server/serialize';
import { TournamentBoard } from '@/components/TournamentBoard';

async function loadContext(id: string): Promise<TournamentContext | null> {
  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: tournamentInclude
  });
  if (!tournament) return null;
  return toDomainContext(tournament);
}

export default async function TournamentDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadContext(id);
  if (!data) notFound();

  return <TournamentBoard data={data} mode="admin" />;
}
