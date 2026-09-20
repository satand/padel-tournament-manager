import { notFound } from 'next/navigation';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp, type TournamentContext } from '@/lib/server/serialize';
import { demoTournament } from '@/lib/demo/demo-data';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, MVP_THROUGH_LABEL } from '@/lib/domain/mvp';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { MatchList } from '@/components/MatchList';

async function loadPublicData(id: string): Promise<(TournamentContext & { isDemo: boolean }) | null> {
  if (id === 'demo-tournament') {
    return {
      id: demoTournament.id,
      name: demoTournament.name,
      format: demoTournament.format,
      status: 'RUNNING',
      rules: demoTournament.rules,
      settings: null,
      participants: demoTournament.participants,
      players: demoTournament.players,
      matches: demoTournament.matches,
      mvpVotes: demoTournament.mvpVotes,
      courts: demoTournament.courts,
      groups: [],
      isDemo: true
    };
  }

  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }, { publicToken: id }] },
    include: tournamentInclude
  });
  if (!tournament || !tournament.publicEnabled) return null;
  return { ...toDomainContext(tournament), isDemo: false };
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPublicData(id);
  if (!data) notFound();

  const avgMvp = averageMvpRatingByParticipant(data.participants, data.mvpVotes);
  const overallRanking = calculateRanking(data.participants, data.matches, data.rules, avgMvp);
  const mvp = computeMvp(data);
  const courtNames: Record<string, string> = Object.fromEntries(data.courts.map((c) => [c.id, c.name]));

  const completed = data.matches.filter((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status));
  const scheduled = data.matches.filter((m) => ['SCHEDULED', 'IN_PROGRESS'].includes(m.status));
  const showGroups = data.groups.length > 0;

  return (
    <main className="grid">
      <section className="panel">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge">Pagina pubblica</span>
          {data.isDemo && <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>DEMO</span>}
        </div>
        <h1>{data.name}</h1>
        <p className="lead">Consultazione: calendario, risultati e classifiche aggiornate. Nessuna funzione amministrativa.</p>
      </section>

      {showGroups ? (
        data.groups.map((group) => {
          const groupParticipants = data.participants.filter((p) => p.groupId === group.id);
          const groupMatches = data.matches.filter((m) => m.groupId === group.id);
          const ranking = calculateRanking(groupParticipants, groupMatches, data.rules, avgMvp);
          return (
            <section className="panel" key={group.id}>
              <h2>Classifica — {group.name}</h2>
              {ranking.length > 0 ? <RankingTable rows={ranking} /> : <p style={{ color: 'var(--muted)' }}>Nessuna squadra.</p>}
            </section>
          );
        })
      ) : (
        overallRanking.length > 0 && <section className="panel"><h2>Classifica</h2><RankingTable rows={overallRanking} /></section>
      )}

      {mvp.rows.length > 0 && (
        <section className="panel">
          <h2>Miglior giocatore <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>· fino alla {MVP_THROUGH_LABEL[mvp.through]}</span></h2>
          <MVPTable rows={mvp.rows} />
        </section>
      )}

      {completed.length > 0 && (
        <section className="panel"><h2>Risultati ({completed.length})</h2><MatchList matches={completed} participants={data.participants} courtNames={courtNames} /></section>
      )}
      {scheduled.length > 0 && (
        <section className="panel"><h2>Prossime partite ({scheduled.length})</h2><MatchList matches={scheduled} participants={data.participants} courtNames={courtNames} /></section>
      )}
      {data.matches.length === 0 && (
        <section className="panel"><p style={{ color: 'var(--muted)' }}>Il torneo non ha ancora partite programmate.</p></section>
      )}
    </main>
  );
}
