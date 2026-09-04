import Link from 'next/link';
import { prisma } from '@/lib/server/db';
import { DeleteTournamentButton } from '@/components/DeleteTournamentButton';

export const dynamic = 'force-dynamic';

export default async function TournamentsListPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      settings: true,
      _count: { select: { participants: true, matches: true } },
    },
  });

  return (
    <main className="grid">
      <section className="panel">
        <h1>I tuoi tornei</h1>
        <p className="lead">Tutti i tornei creati. Seleziona un torneo per aprire la dashboard organizzatore.</p>
        <div className="actions">
          <Link className="button" href="/new-tournament">Nuovo torneo</Link>
          <Link className="button secondary" href="/tournaments/demo-tournament">Apri demo</Link>
        </div>
      </section>

      {tournaments.length === 0 && (
        <section className="panel">
          <p style={{ color: 'var(--muted)' }}>Nessun torneo creato. Usa il pulsante qui sopra per crearne uno.</p>
        </section>
      )}

      <section className="grid grid-2">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/tournaments/${t.slug}`} style={{ textDecoration: 'none' }}>
            <article className="panel" style={{ cursor: 'pointer', transition: 'border-color .15s', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <span className="badge">{t.format.replace(/_/g, ' ')}</span>
                  <h3 style={{ marginTop: 8 }}>{t.name}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{
                    background: t.status === 'RUNNING' ? '#dcfce7' : t.status === 'COMPLETED' ? '#e0e7ff' : '#f3f4f6',
                    color: t.status === 'RUNNING' ? '#166534' : t.status === 'COMPLETED' ? '#3730a3' : '#6b7280',
                  }}>{t.status}</span>
                  <DeleteTournamentButton tournamentId={t.id} tournamentName={t.name} />
                </div>
              </div>
              <div className="grid grid-3" style={{ marginTop: 12 }}>
                <div className="stat"><div className="stat-label">Partecipanti</div><div className="stat-value">{t._count.participants}</div></div>
                <div className="stat"><div className="stat-label">Partite</div><div className="stat-value">{t._count.matches}</div></div>
                <div className="stat"><div className="stat-label">Campi</div><div className="stat-value">{t.settings?.courtsCount ?? '—'}</div></div>
              </div>
              {t.startsAt && (
                <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10, marginBottom: 0 }}>
                  Inizio: {new Date(t.startsAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                Creato il {new Date(t.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </article>
          </Link>
        ))}
      </section>
    </main>
  );
}
