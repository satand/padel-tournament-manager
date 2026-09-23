import { notFound } from 'next/navigation';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp, type TournamentContext } from '@/lib/server/serialize';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, MVP_THROUGH_LABEL } from '@/lib/domain/mvp';
import { phaseLabel, matchStatusLabel } from '@/lib/domain/labels';
import type { Match } from '@/lib/domain/types';
import { PresentCarousel, type PresentScreen, type PresentSlide } from '@/components/PresentCarousel';

export const dynamic = 'force-dynamic';

async function loadPresentData(id: string): Promise<TournamentContext | null> {
  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }, { publicToken: id }] },
    include: tournamentInclude
  });
  if (!tournament) return null;
  return toDomainContext(tournament);
}

function fmtWhen(iso?: string): string {
  if (!iso) return 'Orario da assegnare';
  return new Date(iso).toLocaleString('it-IT', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

const BRACKET_SHORT: Record<string, string> = { GOLD: 'Gold', SILVER: 'Argento', UNICO: 'Tabellone' };
const DONE: Match['status'][] = ['COMPLETED', 'WALKOVER', 'RETIRED'];

function matchSlide(m: Match, names: Map<string, string>, courtNames: Map<string, string>): PresentSlide {
  const done = DONE.includes(m.status);
  const teamA = m.participantAId ? (names.get(m.participantAId) ?? 'in attesa') : 'in attesa';
  const teamB = m.participantBId ? (names.get(m.participantBId) ?? 'in attesa') : 'in attesa';
  const winnerName = done && m.winnerId ? (names.get(m.winnerId) ?? undefined) : undefined;
  const score = m.sets.length ? m.sets.map((s) => `${s.gamesA}-${s.gamesB}`).join('  ') : '';
  const bracketKey = m.bracket ?? 'UNICO';
  return {
    kind: 'match',
    id: m.id,
    title: `${phaseLabel(m.phase)}${BRACKET_SHORT[bracketKey] ? ` · ${BRACKET_SHORT[bracketKey]}` : ''}`,
    phaseLabel: phaseLabel(m.phase),
    bracketLabel: BRACKET_SHORT[bracketKey],
    teamA,
    teamB,
    score,
    statusLabel: matchStatusLabel(m.status),
    done,
    winnerName,
    court: m.courtId ? courtNames.get(m.courtId) : undefined,
    when: fmtWhen(m.scheduledAt)
  };
}

export default async function PresentTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPresentData(id);
  if (!data) notFound();

  const names = new Map(data.participants.map((p) => [p.id, p.displayName]));
  const courtNames = new Map(data.courts.map((c) => [c.id, c.name]));
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
  const champion = championOf('GOLD') ?? championOf('UNICO');
  const silverWinner = championOf('SILVER');

  const screens: PresentScreen[] = [];

  if (data.groups.length > 0) {
    const slides: PresentSlide[] = data.groups.map((group) => ({
      kind: 'group',
      id: group.id,
      title: group.name,
      rows: calculateRanking(data.participants.filter((p) => p.groupId === group.id), data.matches.filter((m) => m.groupId === group.id), data.rules, avgMvp)
    }));
    screens.push({ id: 'groups', label: 'Gironi', slides });
  }

  const bracketOrder = ['GOLD', 'UNICO', 'SILVER'].filter((k) => byBracket.has(k));
  const phaseMap = new Map<string, Match[]>();
  for (const m of byBracket.get('GOLD') ?? []) phaseMap.set(m.phase ?? 'final', [...(phaseMap.get(m.phase ?? 'final') ?? []), m]);
  for (const m of byBracket.get('UNICO') ?? []) phaseMap.set(m.phase ?? 'final', [...(phaseMap.get(m.phase ?? 'final') ?? []), m]);
  for (const m of byBracket.get('SILVER') ?? []) phaseMap.set(m.phase ?? 'final', [...(phaseMap.get(m.phase ?? 'final') ?? []), m]);

  const phaseEntries = [...phaseMap.entries()]
    .map(([phase, ms]) => ({ phase, ms, roundMin: Math.min(...ms.map((m) => m.roundIndex ?? 0)), hasPending: ms.some((m) => ['SCHEDULED', 'IN_PROGRESS'].includes(m.status)) }))
    .sort((a, b) => a.roundMin - b.roundMin);

  let defaultPhaseScreen: string | undefined;
  for (const entry of phaseEntries) {
    const ordered = [...entry.ms].sort((a, b) => (bracketOrder.indexOf(a.bracket ?? 'UNICO') - bracketOrder.indexOf(b.bracket ?? 'UNICO')) || a.id.localeCompare(b.id));
    screens.push({
      id: `phase-${entry.phase}`,
      label: phaseLabel(entry.phase),
      slides: ordered.map((m) => matchSlide(m, names, courtNames))
    });
    if (entry.hasPending && !defaultPhaseScreen) defaultPhaseScreen = `phase-${entry.phase}`;
  }

  const overall = calculateRanking(data.participants, data.matches, data.rules, avgMvp);
  if (overall.length > 0) {
    screens.push({ id: 'standings', label: 'Classifica', slides: [{ kind: 'standings', id: 'standings', title: 'Classifica generale', rows: overall }] });
  }

  if (mvp.rows.length > 0) {
    screens.push({ id: 'mvp', label: 'MVP', slides: [{ kind: 'mvp', id: 'mvp', title: 'Miglior giocatore', subtitle: `· fino alla ${MVP_THROUGH_LABEL[mvp.through]}`, rows: mvp.rows.slice(0, 12) }] });
  }

  if (champion) {
    screens.push({ id: 'champion', label: '🏆 Campione', slides: [{ kind: 'champion', id: 'champion', title: 'Campione', champion, silver: silverWinner ?? undefined }] });
  }

  const defaultScreenId = champion ? 'champion' : defaultPhaseScreen ?? (data.groups.length > 0 ? 'groups' : screens[0]?.id);
  const slideMs = (data.settings?.presentSlideSeconds ?? 6) * 1000;

  return <PresentCarousel name={data.name} screens={screens} slideMs={slideMs} defaultScreenId={defaultScreenId} />;
}
