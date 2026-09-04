import Link from 'next/link';
import { demoTournament } from '@/lib/demo/demo-data';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, calculateMVPStandings } from '@/lib/domain/mvp';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';

export default function HomePage() {
  const avgMvp = averageMvpRatingByParticipant(demoTournament.participants, demoTournament.mvpVotes);
  const ranking = calculateRanking(demoTournament.participants, demoTournament.matches, demoTournament.rules, avgMvp);
  const mvp = calculateMVPStandings(demoTournament.players, demoTournament.participants, demoTournament.matches, demoTournament.mvpVotes, demoTournament.mvpSettings);
  const completedMatches = demoTournament.matches.filter((match) => match.status === 'COMPLETED').length;

  return (
    <main className="grid">
      <section className="hero">
        <div className="panel">
          <span className="badge">PWA · desktop · iPad · smartphone</span>
          <h1>Gestione completa tornei di Padel.</h1>
          <p className="lead">Base applicativa modulare per tornei a coppie, individuali, gironi, eliminazione diretta, americano, mexicano, king/queen of the court e formato custom.</p>
          <div className="actions"><Link className="button" href="/new-tournament">Crea torneo</Link><Link className="button secondary" href="/tournaments/demo-tournament">Apri demo</Link></div>
        </div>
        <div className="panel grid">
          <div className="grid grid-2">
            <div className="stat"><div className="stat-label">Partecipanti</div><div className="stat-value">{demoTournament.participants.length}</div></div>
            <div className="stat"><div className="stat-label">Campi</div><div className="stat-value">{demoTournament.courts.length}</div></div>
            <div className="stat"><div className="stat-label">Match conclusi</div><div className="stat-value">{completedMatches}</div></div>
            <div className="stat"><div className="stat-label">Leader MVP</div><div className="stat-value">{mvp[0]?.displayName.split(' ')[0]}</div></div>
          </div>
        </div>
      </section>
      <section className="grid grid-2">
        <div className="panel"><h2>Classifica demo</h2><RankingTable rows={ranking} /></div>
        <div className="panel"><h2>Miglior giocatore</h2><MVPTable rows={mvp} /></div>
      </section>
    </main>
  );
}
