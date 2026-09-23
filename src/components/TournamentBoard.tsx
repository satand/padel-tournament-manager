import Link from 'next/link';
import { computeMvp, type TournamentContext } from '@/lib/server/serialize';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, MVP_THROUGH_LABEL } from '@/lib/domain/mvp';
import { bracketPhaseReached, bracketPlacements, generalPhaseReached } from '@/lib/domain/finals';
import { bracketLabel } from '@/lib/domain/labels';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { MatchList } from '@/components/MatchList';
import { RandomizeGroupResultsEasterEgg } from '@/components/RandomizeGroupResultsEasterEgg';
import { RandomizeFinalResultsEasterEgg } from '@/components/RandomizeFinalResultsEasterEgg';
import { TournamentActions } from '@/components/TournamentActions';
import { DeleteTournamentButton } from '@/components/DeleteTournamentButton';

const DONE: string[] = ['COMPLETED', 'WALKOVER', 'RETIRED'];

export function TournamentBoard({ data, mode }: { data: TournamentContext; mode: 'admin' | 'public' }) {
  const isAdmin = mode === 'admin';

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
  const completedMatches = groupOnly.filter((m) => DONE.includes(m.status));
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
  const groupMatchesDone = groupOnly.filter((m) => DONE.includes(m.status)).length;
  const groupsConcluded = groupOnly.length > 0 && groupMatchesDone === groupOnly.length;
  const qualifiedPerGroup = data.settings?.qualifiedPerGroup ?? 2;
  const qualifiedCount = data.groups.reduce((sum, g) => {
    const size = data.participants.filter((p) => p.groupId === g.id && !p.isWithdrawn).length;
    return sum + Math.min(qualifiedPerGroup, size);
  }, 0);
  const completedAll = data.matches.filter((m) => DONE.includes(m.status)).length;
  const locked = data.status === 'COMPLETED';
  const finalsCompleted = finalMatches.length > 0 && finalMatches.every((m) => DONE.includes(m.status));
  const canEdit = isAdmin && !locked;
  const groupDisplay = [...scheduledMatches, ...completedMatches];
  const mvpScopeProps = { mvpEnabled: data.settings?.mvpEnabled ?? true, mvpThroughPhase: data.settings?.mvpThroughPhase ?? 'FINAL' };
  const mvpVotesInfo = data.mvpVotes.map((v) => ({ matchId: v.matchId, playerId: v.playerId, rating: v.rating, penalty: v.penalty }));

  const participantNames = new Map(data.participants.map((p) => [p.id, p.displayName]));
  const bracketWinner = (bracket: 'GOLD' | 'SILVER' | null): string | null => {
    const fin = finalMatches.find((m) => (m.bracket ?? null) === bracket && m.phase === 'final');
    if (fin?.winnerId && DONE.includes(fin.status)) return participantNames.get(fin.winnerId) ?? fin.winnerId;
    return null;
  };
  const winners: { label: string; name: string }[] = [];
  const goldWinner = bracketWinner('GOLD');
  const silverWinner = bracketWinner('SILVER');
  const singleWinner = bracketWinner(null);
  if (goldWinner) winners.push({ label: 'Tabellone Gold', name: goldWinner });
  if (silverWinner) winners.push({ label: 'Tabellone Silver', name: silverWinner });
  if (singleWinner) winners.push({ label: 'Tabellone', name: singleWinner });

  const placementTables = bracketPlacements(data.participants, data.matches);
  const generalPhase = generalPhaseReached(data.participants, data.matches, showGroups ? 'Gironi' : '—');

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
          {isAdmin && (
            <DeleteTournamentButton tournamentId={data.id} tournamentName={data.name} redirectTo="/tournaments" />
          )}
        </div>

        {locked && winners.length > 0 && (
          isAdmin ? (
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
          ) : (
            <p style={{ margin: '12px 0 0', fontSize: 15 }}>
              🏆 {winners.length > 1
                ? winners.map((w) => <span key={w.label} style={{ marginRight: 14 }}><strong>{w.label}:</strong> {w.name}</span>)
                : <>Campione: <strong>{winners[0].name}</strong></>}
            </p>
          )
        )}

        <p className="lead">
          {isAdmin
            ? 'Dashboard organizzatore: coppie, calendari, classifiche per girone e MVP.'
            : 'Consultazione: calendario, risultati e classifiche aggiornate. Nessuna funzione amministrativa.'}
        </p>

        {isAdmin && (
          <>
            <div className="actions">
              <Link className="button secondary" href={`/public/${data.id}`} target="_blank">Apri pagina pubblica</Link>
              <Link className="button secondary" href={`/present/${data.id}`} target="_blank">Schermo di proiezione</Link>
            </div>
            <div className="actions" style={{ marginTop: 6 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center' }}>Esporta CSV:</span>
              <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=calendar`} download>Calendario</a>
              <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=ranking`} download>Classifica Generale</a>
              {finalMatches.length > 0 && (
                <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=finals`} download>Classifica Finali</a>
              )}
              <a className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/api/tournaments/${data.id}/export?type=mvp`} download>MVP</a>
            </div>
          </>
        )}

        <div className="grid grid-3">
          <div className="stat"><div className="stat-label">Coppie</div><div className="stat-value">{data.participants.length}</div></div>
          <div className="stat"><div className="stat-label">Partite</div><div className="stat-value">{data.matches.length}</div></div>
          <div className="stat"><div className="stat-label">Concluse</div><div className="stat-value">{completedAll}</div></div>
        </div>
      </section>

      {isAdmin && data.status !== 'COMPLETED' && (
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

      {showGroups && data.groups.map((group) => {
        const groupParticipants = data.participants.filter((p) => p.groupId === group.id);
        const groupMatches = data.matches.filter((m) => m.groupId === group.id);
        const ranking = calculateRanking(groupParticipants, groupMatches, data.rules, avgMvp);
        return (
          <section className="panel" key={group.id}>
            <h2>Classifica — {group.name}</h2>
            {ranking.length > 0 ? <RankingTable rows={ranking} /> : <p style={{ color: 'var(--muted)' }}>Nessuna squadra in questo girone.</p>}
          </section>
        );
      })}

      {overallRanking.length > 0 && (
        <section className="panel">
          <h2>Classifica generale</h2>
          <RankingTable rows={overallRanking} phaseReached={generalPhase} />
        </section>
      )}

      {placementTables.length > 0 && (
        <section className="panel">
          <h2>Classifiche fase finale</h2>
          {finalGroups.map(({ bracket, matches }) => {
            const table = placementTables.find((t) => t.bracket === bracket);
            const ids = new Set(matches.flatMap((m) => [m.participantAId, m.participantBId]).filter((x): x is string => !!x));
            const rows = calculateRanking(data.participants.filter((p) => ids.has(p.id)), matches, data.rules, avgMvp);
            return (
              <div key={bracket ?? 'single'}>
                <h3 style={{ marginTop: 14 }}>{bracket ? `Tabellone ${bracketLabel(bracket)}` : 'Tabellone'}</h3>
                {rows.length > 0 ? <RankingTable rows={rows} phaseReached={table ? bracketPhaseReached(table) : undefined} /> : <p style={{ color: 'var(--muted)' }}>Nessuna squadra.</p>}
              </div>
            );
          })}
        </section>
      )}

      {mvp.rows.length > 0 && (
        <section className="panel">
          <h2>Miglior giocatore del torneo <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>· calcolato fino alla {MVP_THROUGH_LABEL[mvp.through]}</span></h2>
          <MVPTable rows={mvp.rows} />
        </section>
      )}

      {groupDisplay.length > 0 && (
        <section className="panel">
          {isAdmin
            ? <RandomizeGroupResultsEasterEgg tournamentId={data.id} count={groupDisplay.length} remaining={scheduledMatches.length} />
            : <h2>Fase Gironi ({groupDisplay.length})</h2>}
          <MatchList matches={groupDisplay} participants={data.participants} players={playersForMatch} courtNames={courtNames} groupNames={groupNames} editable={canEdit} mvpVotes={mvpVotesInfo} tournamentId={canEdit ? data.id : undefined} rules={canEdit ? data.rules : undefined} {...mvpScopeProps} />
        </section>
      )}
      {finalMatches.length > 0 && (
        <section className="panel">
          {isAdmin
            ? <RandomizeFinalResultsEasterEgg tournamentId={data.id} count={finalMatches.length} />
            : <h2>Fase finale ({finalMatches.length})</h2>}
          {finalGroups.map(({ bracket, matches }) => (
            <div key={bracket ?? 'single'}>
              <h3 style={{ marginTop: 14 }}>{bracket ? `Tabellone ${bracketLabel(bracket)}` : 'Tabellone'}</h3>
              <MatchList matches={matches} participants={data.participants} players={playersForMatch} courtNames={courtNames} groupNames={groupNames} editable={canEdit} tournamentId={canEdit ? data.id : undefined} rules={canEdit ? data.rules : undefined} showTime={false} {...mvpScopeProps} />
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
