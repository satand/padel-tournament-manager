'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

const FIRST_NAMES = ['Marco', 'Luca', 'Davide', 'Andrea', 'Paolo', 'Enrico', 'Fabio', 'Stefano', 'Alessio', 'Simone', 'Mattia', 'Riccardo', 'Giorgio', 'Pietro', 'Tommaso', 'Lorenzo', 'Federico', 'Nicola', 'Claudio', 'Dario'];
const LAST_NAMES = ['Rossi', 'Bianchi', 'Ferrari', 'Gallo', 'Neri', 'Conti', 'Villa', 'Costa', 'Greco', 'Barbieri', 'Mancini', 'Rinaldi', 'Lombardi', 'Moretti', 'Marchetti', 'Ferrara', 'Guerra', 'Russo', 'Testa', 'Silvestri'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function makeCouples(count: number): { player1: string; player2: string; level: number }[] {
  return Array.from({ length: count }, () => {
    let p1 = makeName();
    let p2 = makeName();
    while (p2 === p1) p2 = makeName();
    const level = Math.round((2 + Math.random() * 6.5) * 10) / 10;
    return { player1: p1, player2: p2, level };
  });
}

function groupCountFor(n: number): number {
  if (n <= 3) return 1;
  return Math.min(8, Math.max(1, Math.floor(n / 3)));
}

function nowLocalInput(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuickSeedTitle() {
  const router = useRouter();
  const clicks = useRef<number[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Test Tournament');
  const [startsAt, setStartsAt] = useState(nowLocalInput());
  const [count, setCount] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function onTitleClick() {
    const t = Date.now();
    clicks.current = [...clicks.current.filter((x) => t - x < 1200), t];
    if (clicks.current.length >= 3) {
      clicks.current = [];
      setError(null);
      setOpen(true);
    }
  }

  function reset() {
    setOpen(false);
    setBusy(false);
  }

  async function generate() {
    const trimmed = name.trim();
    const n = parseInt(count, 10);
    if (!trimmed) {
      setError('Inserisci un nome per il torneo.');
      return;
    }
    if (!Number.isFinite(n) || n < 2 || n > 64) {
      setError('Il numero di coppie deve essere tra 2 e 64.');
      return;
    }
    setBusy(true);
    setError(null);

    let createdId: string | null = null;
    try {
      const createRes = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          format: 'GROUPS_PLUS_FINALS',
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          courtsCount: 2,
          groupCount: groupCountFor(n),
          qualifiedPerGroup: 2,
          splitGoldSilver: true,
          scoringMode: 'GAMES_TARGET',
          targetGames: 16,
          finalStartRound: 'SF',
          mvpEnabled: true,
          mvpThroughPhase: 'GROUP'
        })
      });
      if (!createRes.ok) {
        const b = await createRes.json().catch(() => ({}));
        throw new Error(typeof b.error === 'string' ? b.error : 'Errore nella creazione del torneo.');
      }
      const { tournament } = await createRes.json();
      createdId = tournament.id;

      const couplesRes = await fetch(`/api/tournaments/${tournament.id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couples: makeCouples(n) })
      });
      if (!couplesRes.ok) {
        await fetch(`/api/tournaments/${tournament.id}`, { method: 'DELETE' }).catch(() => undefined);
        createdId = null;
        throw new Error('Errore nell\'inserimento delle coppie.');
      }

      reset();
      router.push(`/tournaments/${tournament.slug ?? tournament.id}`);
    } catch (err) {
      if (createdId) await fetch(`/api/tournaments/${createdId}`, { method: 'DELETE' }).catch(() => undefined);
      setError(err instanceof Error ? err.message : 'Errore imprevisto.');
      setBusy(false);
    }
  }

  return (
    <>
      <h1 onClick={onTitleClick} style={{ cursor: 'default' }}>I tuoi tornei</h1>

      {open && mounted && createPortal((
        <div onClick={reset} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(460px, 100%)', margin: 0 }}>
            <h2 style={{ marginTop: 0 }}>Genera torneo di prova</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Crea un torneo in bozza già configurato con un numero di coppie generate automaticamente. Potrai eliminarlo dalla lista.</p>

            <div className="form-grid" style={{ marginTop: 8, gridTemplateColumns: 'minmax(0, 1fr) 132px' }}>
              <div className="field" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                <label>Nome torneo</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field" style={{ minWidth: 0 }}>
                <label>Data inizio</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ minWidth: 0 }} />
              </div>
              <div className="field" style={{ minWidth: 0 }}>
                <label>N. coppie</label>
                <input type="number" min={2} max={64} value={count} onChange={(e) => setCount(e.target.value)} style={{ minWidth: 0 }} />
              </div>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

            <div className="actions" style={{ marginTop: 10 }}>
              <button className="button" disabled={busy} onClick={generate}>{busy ? 'Generazione...' : 'Genera e apri'}</button>
              <button className="button secondary" disabled={busy} onClick={reset}>Annulla</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
