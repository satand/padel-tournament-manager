import { notFound } from 'next/navigation';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp, type TournamentContext } from '@/lib/server/serialize';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, MVP_THROUGH_LABEL } from '@/lib/domain/mvp';
import { generalPhaseReached, buildProjectionBracketColumns } from '@/lib/domain/finals';
import { bracketLabel } from '@/lib/domain/labels';
import type { Match } from '@/lib/domain/types';
import { PresentCarousel, type ChampionWinner, type PresentScreen, type PresentSlide } from '@/components/PresentCarousel';

export const dynamic = 'force-dynamic';

async function loadPresentData(id: string): Promise<TournamentContext | null> {
  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }, { publicToken: id }] },
    include: tournamentInclude
  });
  if (!tournament) return null;
  return toDomainContext(tournament);
}

const DONE: Match['status'][] = ['COMPLETED', 'WALKOVER', 'RETIRED'];

function bracketSlide(key: string, ms: Match[], names: Map<string, string>): PresentSlide {
  const title = key === 'UNICO' ? 'Tabellone' : `Tabellone ${bracketLabel(key)}`;
  return { kind: 'bracket', id: `bracket-${key}`, title, columns: buildProjectionBracketColumns(ms, names) };
}

export default async function PresentTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPresentData(id);
  if (!data) notFound();

  const names = new Map(data.participants.map((p) => [p.id, p.displayName]));
  const avgMvp = averageMvpRatingByParticipant(data.participants, data.mvpVotes);
  const mvp = computeMvp(data);

  const byBracket = new Map<string, Match[]>();
  for (const m of data.matches.filter((x) => !!x.phase && x.phase !== 'group')) {
    const key = m.bracket ?? 'UNICO';
    byBracket.set(key, [...(byBracket.get(key) ?? []), m]);
  }
  function championOf(bracketKey: string): string | null {
    const final = (byBracket.get(bracketKey) ?? []).find((m) => m.phase === 'final');
    if (final?.winnerId && DONE.includes(final.status)) return names.get(final.winnerId) ?? final.winnerId;
    return null;
  }
  const goldWinner = championOf('GOLD');
  const silverWinner = championOf('SILVER');
  const singleWinner = championOf('UNICO');
  const champion = goldWinner ?? singleWinner;

  const screens: PresentScreen[] = [];

  const overall = calculateRanking(data.participants, data.matches, data.rules, avgMvp);
  if (overall.length > 0) {
    screens.push({ id: 'standings', label: 'Classifica Generale', slides: [{ kind: 'standings', id: 'standings', title: 'Classifica generale', rows: overall, phaseReached: generalPhaseReached(data.participants, data.matches, data.groups.length > 0 ? 'Gironi' : '—') }] });
  }

  if (mvp.rows.length > 0) {
    screens.push({ id: 'mvp', label: 'MVP', slides: [{ kind: 'mvp', id: 'mvp', title: 'Miglior giocatore', subtitle: `· fino alla ${MVP_THROUGH_LABEL[mvp.through]}`, rows: mvp.rows.slice(0, 12) }] });
  }

  if (data.groups.length > 0) {
    const items = data.groups.map((group) => ({
      name: group.name,
      rows: calculateRanking(data.participants.filter((p) => p.groupId === group.id), data.matches.filter((m) => m.groupId === group.id), data.rules, avgMvp)
    }));
    const slides: PresentSlide[] = [];
    for (let i = 0; i < items.length; i += 2) {
      const chunk = items.slice(i, i + 2);
      slides.push({ kind: 'groups', id: `groups-${i}`, title: chunk.map((c) => c.name).join('  ·  '), groups: chunk });
    }
    screens.push({ id: 'groups', label: 'Gironi', slides });
  }

  const bracketSlides: PresentSlide[] = ['GOLD', 'SILVER', 'UNICO']
    .filter((k) => byBracket.has(k))
    .map((k) => bracketSlide(k, byBracket.get(k) ?? [], names));
  if (bracketSlides.length > 0) {
    screens.push({ id: 'finals', label: 'Fase Finale', slides: bracketSlides });
  }

  const winners: ChampionWinner[] = [];
  if (singleWinner) winners.push({ rank: 1, label: 'Campione', team: singleWinner, tone: 'gold' });
  if (goldWinner) winners.push({ rank: 1, label: 'Gold', team: goldWinner, tone: 'gold' });
  if (silverWinner) winners.push({ rank: 1, label: 'Silver', team: silverWinner, tone: 'silver' });
  const mvpWinnerName = mvp.rows.find((row) => row.position === 1)?.displayName ?? mvp.rows[0]?.displayName;
  if (winners.length > 0) {
    const title = winners.length > 1 ? 'Campioni' : 'Campione';
    screens.push({ id: 'champion', label: `🏆 ${title}`, slides: [{ kind: 'champion', id: 'champion', title, winners, ...(mvpWinnerName ? { mvpName: mvpWinnerName } : {}) }] });
  }

  const defaultScreenId = champion ? 'champion' : bracketSlides.length > 0 ? 'finals' : data.groups.length > 0 ? 'groups' : screens[0]?.id;
  const slideMs = (data.settings?.presentSlideSeconds ?? 6) * 1000;

  return <PresentCarousel name={data.name} screens={screens} slideMs={slideMs} defaultScreenId={defaultScreenId} />;
}
