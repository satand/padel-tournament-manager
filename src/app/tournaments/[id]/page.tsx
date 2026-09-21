import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp, type TournamentContext } from '@/lib/server/serialize';
import { demoTournament } from '@/lib/demo/demo-data';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, MVP_THROUGH_LABEL } from '@/lib/domain/mvp';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { MatchList } from '@/components/MatchList';
import { RandomizeGroupResultsEasterEgg } from '@/components/RandomizeGroupResultsEasterEgg';
import { TournamentActions } from '@/components/TournamentActions';
import { DeleteTournamentButton } from '@/components/DeleteTournamentButton';

async function loadContext(id: string): Promise<(TournamentContext & { isDemo: boolean }) | null> {
  if (id === 'demo-tournament') {
    return {
      id: demoTournament.id,
      name: demoTournament.name,
      format: demoTournament.format,
      status: 'RUNNING',
      startsAt: '2026-07-04T09:00:00.000Z',
      rules: demoTournament.rules,
      settings: null,
      participants: demoTournament.participants,
      players: demoTournament.players,
      matches: demoTournament.matches,
      mvpVotes: demoTournament.mvpVotes,
      courts: demoTournament.courts,
      groups: demoTournament.groups,
      isDemo: true
    };
  }

  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: tournamentInclude
  });
  if (!tournament) return null;
  return { ...toDomainContext(tournament), isDemo: false };
}

export default async function TournamentDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadContext(id);
  if (!data) notFound();

  const playerName = new Map(data.players.map((p) => [p.id, p.displayName ?? `${p.firstName} ${p.lastName}`]));
  const avgMvp = averageMvpRatingByParticipant(data.participants, data.mvpVotes);
  const overallRanking = calculateRanking(data.participants, data.matches, data.rules, avgMvp);
  const mvp = computeMvp(data);

  const isFinal = (m: (typeof data.matches)[number]) => !!m.phase && m.phase !== 'group';
  const groupOnly = data.matches.filter((m) => !isFinal(m));
  const finalMatches = data.matches
    .filter(isFinal)
    .sort((a, b) => String(a.bracket ?? '').localeCompare(String(b.bracket ?? '')) || (a.roundIndex ?? 0) - (b.roundIndex ?? 0));
  const scheduledMatches = groupOnly.filter((m) => ['SCHEDULED', 'IN_PROGRESS'].includes(m.status));
  const completedMatches = groupOnly.filter((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status));
  const otherMatches = groupOnly.filter((m) => ['CANCELLED', 'POSTPONED'].includes(m.status));
  const courtNames: Record<string, string> = Object.fromEntries(data.courts.map((c) => [c.id, c.name]));
  const groupNames: Record<string, string> = Object.fromEntries(data.groups.map((g) => [g.id, g.name]));

  const participantsForAdmin = data.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    level: p.level ?? null,
    players: p.playerIds.map((pid) => ({ id: pid, name: playerName.get(pid) ?? pid }))
  }));

  const playersForMatch = data.players.map((p) => ({ id: p.id, displayName: p.displayName ?? `${p.firstName} ${p.lastName}` }));
  const showGroups = data.groups.length > 0;
  const groupMatchesDone = groupOnly.filter((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status)).length;

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
            {data.startsAt && (
              <p style={{ color: 'var(--muted)', fontSize: 14, margin: '2px 0 0' }}>
                Inizio: {new Date(data.startsAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {!data.isDemo && <DeleteTournamentButton tournamentId={data.id} tournamentName={data.name} redirectTo="/tournaments" />}
        </div>
        <p className="lead">Dashboard organizzatore: coppie, calendari, classifiche per girone e MVP provvisorio.</p>
        <div className="actions">
          <Link className="button secondary" href={`/public/${data.isDemo ? 'demo-tournament' : data.id}`} target="_blank">Apri pagina pubblica</Link>
          {!data.isDemo && <Link className="button secondary" href={`/present/${data.id}`} target="_blank">Schermo di proiezione</Link>}
        </div>
        {!data.isDemo && (
          <div className="actions" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center' }}>Esporta CSV:</span>
            <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=calendar`} download>Calendario</a>
            <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=${data.groups.length > 0 ? 'groups' : 'ranking'}`} download>Classifiche</a>
            <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=mvp`} download>MVP</a>
          </div>
        )}
        <div className="grid grid-4">
          <div className="stat"><div className="stat-label">Coppie</div><div className="stat-value">{data.participants.length}</div></div>
          <div className="stat"><div className="stat-label">Partite</div><div className="stat-value">{data.matches.length}</div></div>
          <div className="stat"><div className="stat-label">Concluse</div><div className="stat-value">{completedMatches.length}</div></div>
          <div className="stat"><div className="stat-label">MVP provvisorio</div><div className="stat-value">{mvp.rows[0]?.displayName.split(' ')[0] ?? '—'}</div></div>
        </div>
      </section>

      {!data.isDemo && data.status !== 'COMPLETED' && (
        <TournamentActions
          tournamentId={data.id}
          status={data.status}
          startsAt={data.startsAt}
          participants={participantsForAdmin}
          matchesCount={data.matches.length}
          groups={data.groups}
          settings={data.settings}
          finalsCount={finalMatches.length}
          groupMatchesTotal={groupOnly.length}
          groupMatchesDone={groupMatchesDone}
        />
      )}

      {showGroups ? (
        data.groups.map((group) => {
          const groupParticipants = data.participants.filter((p) => p.groupId === group.id);
          const groupMatches = data.matches.filter((m) => m.groupId === group.id);
          const ranking = calculateRanking(groupParticipants, groupMatches, data.rules, avgMvp);
          return (
            <section className="panel" key={group.id}>
              <h2>Classifica — {group.name}</h2>
              {ranking.length > 0 ? <RankingTable rows={ranking} /> : <p style={{ color: 'var(--muted)' }}>Nessuna squadra in questo girone.</p>}
            </section>
          );
        })
      ) : (
        overallRanking.length > 0 && (
          <section className="panel"><h2>Classifica</h2><RankingTable rows={overallRanking} /></section>
        )
      )}

      {mvp.rows.length > 0 && (
        <section className="panel">
          <h2>Miglior giocatore del torneo <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>· calcolato fino alla {MVP_THROUGH_LABEL[mvp.through]}</span></h2>
          <MVPTable rows={mvp.rows} />
        </section>
      )}

      {scheduledMatches.length > 0 && (
        <section className="panel">
          {data.isDemo ? (
            <h2>Prossime partite ({scheduledMatches.length})</h2>
          ) : (
            <RandomizeGroupResultsEasterEgg tournamentId={data.id} count={scheduledMatches.length} />
          )}
          <MatchList matches={scheduledMatches} participants={data.participants} players={playersForMatch} courtNames={courtNames} groupNames={groupNames} editable={!data.isDemo} tournamentId={data.id} rules={data.rules} />
        </section>
      )}
      {completedMatches.length > 0 && (
        <section className="panel">
          <h2>Risultati ({completedMatches.length})</h2>
          <MatchList matches={completedMatches} participants={data.participants} players={playersForMatch} courtNames={courtNames} groupNames={groupNames} mvpVotes={data.mvpVotes.map((v) => ({ matchId: v.matchId, playerId: v.playerId, rating: v.rating, penalty: v.penalty }))} tournamentId={data.isDemo ? undefined : data.id} rules={data.isDemo ? undefined : data.rules} />
        </section>
      )}
      {finalMatches.length > 0 && (
        <section className="panel">
          <h2>Fase finale ({finalMatches.length})</h2>
          <MatchList matches={finalMatches} participants={data.participants} players={playersForMatch} courtNames={courtNames} groupNames={groupNames} editable={!data.isDemo} tournamentId={data.id} rules={data.rules} />
        </section>
      )}
      {otherMatches.length > 0 && (
        <section className="panel">
          <h2>Rinviate / Cancellate ({otherMatches.length})</h2>
          <MatchList matches={otherMatches} participants={data.participants} courtNames={courtNames} groupNames={groupNames} />
        </section>
      )}
    </main>
  );
}
