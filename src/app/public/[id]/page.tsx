import { notFound } from 'next/navigation';
import { prisma } from '@/lib/server/db';
import { demoTournament } from '@/lib/demo/demo-data';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, calculateMVPStandings } from '@/lib/domain/mvp';
import { defaultTournamentRules, defaultMVPSettings } from '@/lib/domain/types';
import type { Match, MVPVote, Participant, Player } from '@/lib/domain/types';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { MatchList } from '@/components/MatchList';

async function loadPublicData(slug: string) {
  if (slug === 'demo-tournament') {
    return { ...demoTournament, isDemo: true };
  }

  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id: slug }, { slug }, { publicToken: slug }] },
    include: {
      settings: true,
      players: true,
      participants: true,
      matches: { include: { sets: true, mvpVotes: true }, orderBy: { roundIndex: 'asc' } },
      courts: { orderBy: { order: 'asc' } },
    },
  });

  if (!tournament || !tournament.publicEnabled) return null;

  const rules = {
    ...defaultTournamentRules,
    setsPerMatch: tournament.settings?.setsPerMatch ?? 1,
    gamesPerSet: tournament.settings?.gamesPerSet ?? 6,
  };

  const participants: Participant[] = tournament.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    type: p.type as 'PLAYER' | 'TEAM',
    playerIds: p.playerId ? [p.playerId] : [],
  }));

  const players: Player[] = tournament.players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: `${p.firstName} ${p.lastName}`,
  }));

  const matches: Match[] = tournament.matches.map((m) => ({
    id: m.id,
    participantAId: m.participantAId,
    participantBId: m.participantBId,
    status: m.status as Match['status'],
    sets: m.sets.map((s) => ({
      setNumber: s.setNumber,
      gamesA: s.gamesA,
      gamesB: s.gamesB,
      tieBreakA: s.tieBreakA ?? undefined,
      tieBreakB: s.tieBreakB ?? undefined,
    })),
    scheduledAt: m.scheduledAt?.toISOString(),
    courtId: m.courtId ?? undefined,
    phase: m.phase,
    roundIndex: m.roundIndex,
  }));

  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    isDemo: false,
    rules,
    mvpSettings: defaultMVPSettings,
    players,
    participants,
    matches,
    mvpVotes: tournament.matches.flatMap((m) =>
      m.mvpVotes.map((v) => ({
        id: v.id,
        matchId: v.matchId,
        playerId: v.playerId,
        rating: v.rating,
        penalty: v.penalty,
        weight: v.weight,
        source: v.source,
        electedMvp: true,
      }))
    ),
    courts: tournament.courts.map((c) => ({ id: c.id, name: c.name })),
  };
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPublicData(id);

  if (!data) notFound();

  const avgMvp = averageMvpRatingByParticipant(data.participants, data.mvpVotes);
  const ranking = calculateRanking(data.participants, data.matches, data.rules, avgMvp);
  const mvp = calculateMVPStandings(data.players, data.participants, data.matches, data.mvpVotes, data.mvpSettings);
  const courtNames: Record<string, string> = Object.fromEntries(data.courts.map((c) => [c.id, c.name]));

  return (
    <main className="grid">
      <section className="panel">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge">Pagina pubblica</span>
          {data.isDemo && <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>DEMO</span>}
        </div>
        <h1>{data.name}</h1>
        <p className="lead">Consultazione partecipanti: calendario, risultati e classifiche aggiornate. Nessun accesso a funzioni amministrative.</p>
      </section>
      {ranking.length > 0 && (
        <section className="panel"><h2>Classifica</h2><RankingTable rows={ranking} /></section>
      )}
      {mvp.length > 0 && (
        <section className="panel"><h2>Miglior giocatore</h2><MVPTable rows={mvp} /></section>
      )}
      {data.matches.length > 0 && (() => {
        const completed = data.matches.filter((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status));
        const scheduled = data.matches.filter((m) => ['SCHEDULED', 'IN_PROGRESS'].includes(m.status));
        const other = data.matches.filter((m) => ['CANCELLED', 'POSTPONED'].includes(m.status));
        return (
          <>
            {completed.length > 0 && (
              <section className="panel">
                <h2>Risultati ({completed.length})</h2>
                <MatchList matches={completed} participants={data.participants} courtNames={courtNames} />
              </section>
            )}
            {scheduled.length > 0 && (
              <section className="panel">
                <h2>Prossime partite ({scheduled.length})</h2>
                <MatchList matches={scheduled} participants={data.participants} courtNames={courtNames} />
              </section>
            )}
            {other.length > 0 && (
              <section className="panel">
                <h2>Rinviate / Cancellate ({other.length})</h2>
                <MatchList matches={other} participants={data.participants} courtNames={courtNames} />
              </section>
            )}
          </>
        );
      })()}
      {data.matches.length === 0 && (
        <section className="panel">
          <p style={{ color: 'var(--muted)' }}>Il torneo non ha ancora partite programmate. Torna a controllare più tardi.</p>
        </section>
      )}
    </main>
  );
}
