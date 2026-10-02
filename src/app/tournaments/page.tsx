import Link from 'next/link';
import { prisma } from '@/lib/server/db';
import type { TournamentStatus } from '@prisma/client';
import { formatDateTime } from '@/lib/domain/time';
import { DeleteTournamentButton } from '@/components/DeleteTournamentButton';
import { CloneTournamentButton } from '@/components/CloneTournamentButton';
import { QuickSeedTitle } from '@/components/QuickSeedTitle';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS: { value: TournamentStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Bozza' },
  { value: 'READY', label: 'Pronto' },
  { value: 'RUNNING', label: 'In corso' },
  { value: 'COMPLETED', label: 'Completato' }
];
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Bozza', READY: 'Pronto', RUNNING: 'In corso', COMPLETED: 'Completato', ARCHIVED: 'Archiviato'
};
const ALLOWED = new Set<string>(STATUS_OPTIONS.map((s) => s.value));

function badgeStyle(status: string): React.CSSProperties {
  if (status === 'RUNNING') return { background: '#dcfce7', color: '#166534' };
  if (status === 'COMPLETED') return { background: '#e0e7ff', color: '#3730a3' };
  return { background: '#f3f4f6', color: '#6b7280' };
}

export default async function TournamentsListPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const { status } = await searchParams;
  const raw = Array.isArray(status) ? status : status ? [status] : [];
  const selected = STATUS_OPTIONS.map((o) => o.value).filter((v) => raw.some((r) => String(r).split(',').includes(v)));
  const hasFilter = selected.length > 0 && selected.length < STATUS_OPTIONS.length;

  const tournaments = await prisma.tournament.findMany({
    where: hasFilter ? { status: { in: selected as TournamentStatus[] } } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { participants: true } },
      matches: { select: { status: true } }
    }
  });

  const toggleHref = (value: string) => {
    const set = new Set<string>(selected);
    if (set.has(value)) set.delete(value); else set.add(value);
    const next = STATUS_OPTIONS.map((o) => o.value).filter((v) => set.has(v));
    return next.length ? `/tournaments?status=${next.join(',')}` : '/tournaments';
  };

  const chip = (active: boolean): React.CSSProperties => ({
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)' : 'white',
    color: active ? 'white' : 'var(--muted)',
    whiteSpace: 'nowrap'
  });

  return (
    <main className="grid">
      <section className="panel">
        <QuickSeedTitle />
        <p className="lead">Tutti i tornei creati. Seleziona un torneo per aprire la dashboard organizzatore.</p>
        <div className="actions">
          <Link className="button" href="/new-tournament">Nuovo torneo</Link>
        </div>
      </section>

      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>Filtra per stato:</span>
          <Link href="/tournaments" style={chip(!hasFilter)}>Tutti</Link>
          {STATUS_OPTIONS.map((o) => (
            <Link key={o.value} href={toggleHref(o.value)} style={chip(selected.includes(o.value))}>{o.label}</Link>
          ))}
          <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 'auto' }}>{tournaments.length} risultati</span>
        </div>
      </section>

      {tournaments.length === 0 && (
        <section className="panel">
          <p style={{ color: 'var(--muted)' }}>{hasFilter ? 'Nessun torneo con lo stato selezionato.' : 'Nessun torneo creato. Usa il pulsante qui sopra per crearne uno.'}</p>
        </section>
      )}

      <section className="grid grid-2">
        {tournaments.map((t) => {
          const done = t.matches.filter((m) => ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(m.status)).length;
          return (
            <Link key={t.id} href={`/tournaments/${t.slug}`} style={{ textDecoration: 'none' }}>
              <article className="panel" style={{ cursor: 'pointer', transition: 'border-color .15s', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <span className="badge">{t.format.replace(/_/g, ' ')}</span>
                    <h3 style={{ marginTop: 8 }}>{t.name}</h3>
                    {t.startsAt && (
                      <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                        Inizio: {formatDateTime(t.startsAt.toISOString())}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className="badge" style={badgeStyle(t.status)}>{STATUS_LABEL[t.status] ?? t.status}</span>
                    <CloneTournamentButton tournamentId={t.id} tournamentName={t.name} />
                    <DeleteTournamentButton tournamentId={t.id} tournamentName={t.name} />
                  </div>
                </div>
                <div className="grid grid-3" style={{ marginTop: 12 }}>
                  <div className="stat"><div className="stat-label">Coppie</div><div className="stat-value">{t._count.participants}</div></div>
                  <div className="stat"><div className="stat-label">Partite</div><div className="stat-value">{t.matches.length}</div></div>
                  <div className="stat"><div className="stat-label">Concluse</div><div className="stat-value">{done}</div></div>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                  Creato il {new Date(t.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </article>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
