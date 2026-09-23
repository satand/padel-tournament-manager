import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="grid">
      <section className="panel">
        <span className="badge">desktop · tablet · smartphone</span>
        <h1>Gestione completa tornei di Padel.</h1>
        <p className="lead">
          Tornei a coppie con gironi bilanciati per livello e fase finale a tabelloni (Gold/Silver),
          con propagazione automatica dei risultati. Punteggio a set, a target o a tempo, MVP
          calcolabile fino a una fase, schermo di proiezione ed export CSV.
        </p>
        <div className="actions">
          <Link className="button" href="/new-tournament">Crea torneo</Link>
        </div>
      </section>
    </main>
  );
}
