'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

type Props = { tournamentId: string; count: number; remaining?: number };

export function RandomizeGroupResultsEasterEgg({ tournamentId, count, remaining }: Props) {
  const toPlay = remaining ?? count;
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
      const res = await fetch(`/api/tournaments/${tournamentId}/randomize-group-results`, { method: 'POST' });
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
      <h2 onClick={onTitleClick} style={{ cursor: 'default' }}>Fase Gironi ({count})</h2>

      {open && mounted && createPortal((
        <div onClick={reset} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: 'min(480px, 100%)', margin: 0 }}>
            <h2 style={{ marginTop: 0 }}>Risultati casuali dei gironi</h2>
            {toPlay === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Nessuna partita di girone rimasta da completare.</p>
            ) : (
              <p style={{ color: 'var(--muted)' }}>
                Vuoi chiudere con un <strong>punteggio generato a caso</strong> tutte le <strong>{toPlay}</strong> partite di girone ancora senza risultato? Verrà stabilito un vincitore per ciascuna. La fase finale andrà generata a parte.
              </p>
            )}

            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

            <div className="actions" style={{ marginTop: 10 }}>
              {toPlay > 0 && (
                <button className="button" disabled={busy} onClick={generate}>{busy ? 'Generazione...' : 'Genera risultati'}</button>
              )}
              <button className="button secondary" disabled={busy} onClick={reset}>{toPlay > 0 ? 'Annulla' : 'Chiudi'}</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
