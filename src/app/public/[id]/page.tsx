import { notFound } from 'next/navigation';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, type TournamentContext } from '@/lib/server/serialize';
import { TournamentBoard } from '@/components/TournamentBoard';

async function loadPublicData(id: string): Promise<TournamentContext | null> {
  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }, { publicToken: id }] },
    include: tournamentInclude
  });
  if (!tournament || !tournament.publicEnabled) return null;
  return toDomainContext(tournament);
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPublicData(id);
  if (!data) notFound();

  return <TournamentBoard data={data} mode="public" />;
}
