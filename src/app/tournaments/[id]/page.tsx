import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp, type TournamentContext } from '@/lib/server/serialize';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, MVP_THROUGH_LABEL } from '@/lib/domain/mvp';
import { bracketLabel } from '@/lib/domain/labels';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { MatchList } from '@/components/MatchList';
import { RandomizeGroupResultsEasterEgg } from '@/components/RandomizeGroupResultsEasterEgg';
import { RandomizeFinalResultsEasterEgg } from '@/components/RandomizeFinalResultsEasterEgg';
import { TournamentActions } from '@/components/TournamentActions';
import { DeleteTournamentButton } from '@/components/DeleteTournamentButton';

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

  const playerName = new Map(data.players.map((p) => [p.id, p.displayName ?? `${p.firstName} ${p.lastName}`]));
  const avgMvp = averageMvpRatingByParticipant(data.participants, data.mvpVotes);
  const overallRanking = calculateRanking(data.participants, data.matches, data.rules, avgMvp);
  const mvp = computeMvp(data);

  const isFinal = (m: (typeof data.matches)[number]) => !!m.phase && m.phase !== 'group';
  const groupOnly = data.matches.filter((m) => !isFinal(m));
  const finalMatches = data.matches
    .filter(isFinal)
    .sort((a, b) => String(a.bracket ?? '').localeCompare(String(b.bracket ?? '')) || (a.roundIndex ?? 0) - (b.roundIndex ?? 0));
  const finalGroups = (['GOLD', 'SILVER', null] as const)
    .map((bracket) => ({ bracket, matches: finalMatches.filter((m) => (m.bracket ?? null) === bracket) }))
    .filter((g) => g.matches.length > 0);
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
  const groupsConcluded = groupOnly.length > 0 && groupMatchesDone === groupOnly.length;
  const qualifiedPerGroup = data.settings?.qualifiedPerGroup ?? 2;
  const qualifiedCount = data.groups.reduce((sum, g) => {
    const size = data.participants.filter((p) => p.groupId === g.id && !p.isWithdrawn).length;
    return sum + Math.min(qualifiedPerGroup, size);
  }, 0);
  const completedAll = data.matches.filter((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status)).length;
  const locked = data.status === 'COMPLETED';
  const finalsCompleted = finalMatches.length > 0 && finalMatches.every((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status));
  const editing = !locked;
  const groupDisplay = [...scheduledMatches, ...completedMatches];
  const mvpScopeProps = { mvpEnabled: data.settings?.mvpEnabled ?? true, mvpThroughPhase: data.settings?.mvpThroughPhase ?? 'FINAL' };
  const participantNames = new Map(data.participants.map((p) => [p.id, p.displayName]));
  const bracketWinner = (bracket: 'GOLD' | 'SILVER' | null): string | null => {
    const fin = finalMatches.find((m) => (m.bracket ?? null) === bracket && m.phase === 'final');
    if (fin?.winnerId && ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(fin.status)) return participantNames.get(fin.winnerId) ?? fin.winnerId;
    return null;
  };
  const winners: { label: string; name: string }[] = [];
  const goldWinner = bracketWinner('GOLD');
  const silverWinner = bracketWinner('SILVER');
  const singleWinner = bracketWinner(null);
  if (goldWinner) winners.push({ label: 'Tabellone Gold', name: goldWinner });
  if (silverWinner) winners.push({ label: 'Tabellone Silver', name: silverWinner });
  if (singleWinner) winners.push({ label: 'Tabellone', name: singleWinner });

  return (
    <main className="grid">
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge">{data.format}</span>
            </div>
            <h1>{data.name}</h1>
            {data.startsAt && (
              <p style={{ color: 'var(--muted)', fontSize: 14, margin: '2px 0 0' }}>
                Inizio: {new Date(data.startsAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <DeleteTournamentButton tournamentId={data.id} tournamentName={data.name} redirectTo="/tournaments" />
        </div>
        {locked && winners.length > 0 && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fcd34d', display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#92400e', fontSize: 15 }}>🏆 {winners.length > 1 ? 'Vincitori fase finale' : 'Campione'}</span>
            {winners.length > 1
              ? winners.map((w) => (
                  <span key={w.label} style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{w.label}:</span> <strong>{w.name}</strong>
                  </span>
                ))
              : <span style={{ fontSize: 15, fontWeight: 700 }}>{winners[0].name}</span>}
          </div>
        )}
        <p className="lead">Dashboard organizzatore: coppie, calendari, classifiche per girone e MVP.</p>
        <div className="actions">
          <Link className="button secondary" href={`/public/${data.id}`} target="_blank">Apri pagina pubblica</Link>
          <Link className="button secondary" href={`/present/${data.id}`} target="_blank">Schermo di proiezione</Link>
        </div>
        <div className="actions" style={{ marginTop: 6 }}>
          <span style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center' }}>Esporta CSV:</span>
          <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=calendar`} download>Calendario</a>
          <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=${data.groups.length > 0 ? 'groups' : 'ranking'}`} download>Classifiche</a>
          <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=mvp`} download>MVP</a>
        </div>
        <div className="grid grid-3">
          <div className="stat"><div className="stat-label">Coppie</div><div className="stat-value">{data.participants.length}</div></div>
          <div className="stat"><div className="stat-label">Partite</div><div className="stat-value">{data.matches.length}</div></div>
          <div className="stat"><div className="stat-label">Concluse</div><div className="stat-value">{completedAll}</div></div>
        </div>
      </section>

      {data.status !== 'COMPLETED' && (
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
          groupsConcluded={groupsConcluded}
          qualifiedCount={qualifiedCount}
          finalsCompleted={finalsCompleted}
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

      {groupDisplay.length > 0 && (
        <section className="panel">
          <RandomizeGroupResultsEasterEgg tournamentId={data.id} count={groupDisplay.length} remaining={scheduledMatches.length} />
          <MatchList matches={groupDisplay} participants={data.participants} players={playersForMatch} courtNames={courtNames} groupNames={groupNames} editable={editing} mvpVotes={data.mvpVotes.map((v) => ({ matchId: v.matchId, playerId: v.playerId, rating: v.rating, penalty: v.penalty }))} tournamentId={editing ? data.id : undefined} rules={editing ? data.rules : undefined} {...mvpScopeProps} />
        </section>
      )}
      {finalMatches.length > 0 && (
        <section className="panel">
          <RandomizeFinalResultsEasterEgg tournamentId={data.id} count={finalMatches.length} />
          {finalGroups.map(({ bracket, matches }) => (
            <div key={bracket ?? 'single'}>
              <h3 style={{ marginTop: 14 }}>{bracket ? `Tabellone ${bracketLabel(bracket)}` : 'Tabellone'}</h3>
              <MatchList matches={matches} participants={data.participants} players={playersForMatch} courtNames={courtNames} groupNames={groupNames} editable={editing} tournamentId={editing ? data.id : undefined} rules={editing ? data.rules : undefined} showTime={false} {...mvpScopeProps} />
            </div>
          ))}
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
