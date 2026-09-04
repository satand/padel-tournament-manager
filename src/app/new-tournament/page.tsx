import { TournamentWizard } from '@/components/TournamentWizard';

export default function NewTournamentPage() {
  return (
    <main className="grid">
      <section className="panel">
        <h1>Creazione torneo guidata</h1>
        <p className="lead">Wizard in 6 step: dati generali, formato, partecipanti, regole di punteggio, calendario e conferma.</p>
      </section>
      <TournamentWizard />
    </main>
  );
}
