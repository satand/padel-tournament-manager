import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/server/db';
import { demoTournament } from '@/lib/demo/demo-data';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, calculateMVPStandings } from '@/lib/domain/mvp';
import { defaultTournamentRules, defaultMVPSettings } from '@/lib/domain/types';
import type { Match, Participant, Player, MVPVote } from '@/lib/domain/types';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { MatchList } from '@/components/MatchList';
import { TournamentActions } from '@/components/TournamentActions';
import { DeleteTournamentButton } from '@/components/DeleteTournamentButton';

async function loadTournament(slug: string) {
  if (slug === 'demo-tournament') {
    return { ...demoTournament, isDemo: true as const };
  }

  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      settings: true,
      players: true,
      teams: { include: { members: { include: { player: true } } } },
      participants: true,
      matches: { include: { sets: true, mvpVotes: true }, orderBy: { roundIndex: 'asc' } },
      courts: { orderBy: { order: 'asc' } },
    },
  });

  if (!tournament) return null;

  const settings = tournament.settings;
  const rules = {
    ...defaultTournamentRules,
    setsPerMatch: settings?.setsPerMatch ?? defaultTournamentRules.setsPerMatch,
    gamesPerSet: settings?.gamesPerSet ?? defaultTournamentRules.gamesPerSet,
    allowDraws: settings?.allowDraws ?? defaultTournamentRules.allowDraws,
    tieBreakEnabled: settings?.tieBreakEnabled ?? defaultTournamentRules.tieBreakEnabled,
    superTieBreakEnabled: settings?.superTieBreakEnabled ?? defaultTournamentRules.superTieBreakEnabled,
    goldenPointEnabled: settings?.goldenPointEnabled ?? defaultTournamentRules.goldenPointEnabled,
    killerPointEnabled: settings?.killerPointEnabled ?? defaultTournamentRules.killerPointEnabled,
  };

  const teamPlayerMap = new Map<string, string[]>();
  for (const team of tournament.teams) {
    teamPlayerMap.set(team.id, team.members.map((m) => m.playerId));
  }

  const participants: Participant[] = tournament.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    type: p.type as 'PLAYER' | 'TEAM',
    playerIds: p.playerId ? [p.playerId] : (p.teamId ? teamPlayerMap.get(p.teamId) ?? [] : []),
    seed: p.seed ?? undefined,
    isWithdrawn: p.isWithdrawn,
  }));

  const players: Player[] = tournament.players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: `${p.firstName} ${p.lastName}`,
    isWithdrawn: p.isWithdrawn,
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
      isSuperTieBreak: s.isSuperTieBreak,
    })),
    scheduledAt: m.scheduledAt?.toISOString(),
    courtId: m.courtId ?? undefined,
    groupId: m.groupId ?? undefined,
    phase: m.phase,
    phaseWeight: m.phaseWeight,
    winnerId: m.winnerId ?? undefined,
    note: m.note ?? undefined,
  }));

  const mvpVotes: MVPVote[] = tournament.matches.flatMap((m) =>
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
  );

  const courts = tournament.courts.map((c) => ({
    id: c.id,
    name: c.name,
    order: c.order,
  }));

  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    participantType: tournament.participantType,
    status: tournament.status,
    isDemo: false as const,
    courts,
    rules,
    mvpSettings: defaultMVPSettings,
    players,
    participants,
    matches,
    mvpVotes,
  };
}

export default async function TournamentDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadTournament(id);

  if (!data) notFound();

  const avgMvp = averageMvpRatingByParticipant(data.participants, data.mvpVotes);
  const ranking = calculateRanking(data.participants, data.matches, data.rules, avgMvp);
  const mvp = calculateMVPStandings(data.players, data.participants, data.matches, data.mvpVotes, data.mvpSettings);
  const scheduledMatches = data.matches.filter((match) => ['SCHEDULED', 'IN_PROGRESS'].includes(match.status));
  const completedMatches = data.matches.filter((match) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(match.status));
  const otherMatches = data.matches.filter((match) => ['CANCELLED', 'POSTPONED'].includes(match.status));
  const courtNames: Record<string, string> = Object.fromEntries(data.courts.map((c) => [c.id, c.name]));

  return (
    <main className="grid">
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge">{data.format}</span>
              {data.isDemo && <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>DEMO</span>}
            </div>
            <h1>{data.name}</h1>
          </div>
          {!data.isDemo && (
            <DeleteTournamentButton tournamentId={data.id} tournamentName={data.name} redirectTo="/tournaments" />
          )}
        </div>
        <p className="lead">Dashboard organizzatore con stato torneo, prossime partite, ultimi risultati, classifiche e MVP provvisorio.</p>
        <div className="actions">
          <Link className="button secondary" href={`/public/${data.isDemo ? 'demo-tournament' : data.id}`} target="_blank">
            Apri pagina pubblica
          </Link>
        </div>
        <div className="grid grid-4">
          <div className="stat"><div className="stat-label">Partecipanti</div><div className="stat-value">{data.participants.length}</div></div>
          <div className="stat"><div className="stat-label">Partite</div><div className="stat-value">{data.matches.length}</div></div>
          <div className="stat"><div className="stat-label">Concluse</div><div className="stat-value">{completedMatches.length}</div></div>
          <div className="stat"><div className="stat-label">MVP provvisorio</div><div className="stat-value">{mvp[0]?.displayName.split(' ')[0] ?? '—'}</div></div>
        </div>
      </section>
      {!data.isDemo && data.status !== 'COMPLETED' && (
        <TournamentActions
          tournamentId={data.id}
          participantType={data.participantType}
          participantsCount={data.participants.length}
          matchesCount={data.matches.length}
          participantsList={data.participants.map((p) => ({ id: p.id, displayName: p.displayName }))}
        />
      )}
      {ranking.length > 0 && <section className="panel"><h2>Classifica</h2><RankingTable rows={ranking} /></section>}
      {mvp.length > 0 && <section className="panel"><h2>Miglior giocatore del torneo</h2><MVPTable rows={mvp} /></section>}
      {scheduledMatches.length > 0 && (
        <section className="panel">
          <h2>Prossime partite ({scheduledMatches.length})</h2>
          <MatchList
            matches={scheduledMatches}
            participants={data.participants}
            players={data.players.map((p) => ({ id: p.id, displayName: p.displayName ?? `${p.firstName} ${p.lastName}` }))}
            courtNames={courtNames}
            editable={!data.isDemo}
            tournamentId={data.id}
            rules={data.rules}
          />
        </section>
      )}
      {completedMatches.length > 0 && (
        <section className="panel">
          <h2>Risultati ({completedMatches.length})</h2>
          <MatchList
            matches={completedMatches}
            participants={data.participants}
            players={data.players.map((p) => ({ id: p.id, displayName: p.displayName ?? `${p.firstName} ${p.lastName}` }))}
            courtNames={courtNames}
            mvpVotes={data.mvpVotes.map((v) => ({ matchId: v.matchId, playerId: v.playerId, rating: v.rating, penalty: v.penalty }))}
            tournamentId={data.isDemo ? undefined : data.id}
            rules={data.isDemo ? undefined : data.rules}
          />
        </section>
      )}
      {otherMatches.length > 0 && (
        <section className="panel">
          <h2>Rinviate / Cancellate ({otherMatches.length})</h2>
          <MatchList matches={otherMatches} participants={data.participants} courtNames={courtNames} />
        </section>
      )}
    </main>
  );
}
