'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

type Props = { tournamentId: string; count: number };

export function RandomizeFinalResultsEasterEgg({ tournamentId, count }: Props) {
  const router = useRouter();
  const clicks = useRef<number[]>([]);
  const [open, setOpen] = useState(false);
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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/randomize-final-results`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : `Errore (${res.status}).`);
      }
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto.');
      setBusy(false);
    }
  }

  return (
    <>
      <h2 onClick={onTitleClick} style={{ cursor: 'default' }}>Fase finale ({count})</h2>

      {open && mounted && createPortal((
        <div onClick={reset} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(500px, 100%)', margin: 0 }}>
            <h2 style={{ marginTop: 0 }}>Risultati casuali — fase finale</h2>
            {count === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Nessuna partita nella fase finale.</p>
            ) : (
              <p style={{ color: 'var(--muted)' }}>
                Vuoi chiudere con un <strong>punteggio generato a caso</strong> le partite della fase finale <strong>già giocabili</strong> (con entrambi i partecipanti)? I vincitori verranno propagati al turno successivo, che resterà da giocare. L'MVP viene inserito solo per le fasi comprese in "Conta MVP fino a".
              </p>
            )}

            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

            <div className="actions" style={{ marginTop: 10 }}>
              {count > 0 && (
                <button className="button" disabled={busy} onClick={generate}>{busy ? 'Generazione...' : 'Genera risultati'}</button>
              )}
              <button className="button secondary" disabled={busy} onClick={reset}>{count > 0 ? 'Annulla' : 'Chiudi'}</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
