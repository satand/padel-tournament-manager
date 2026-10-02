'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  tournamentId: string;
  tournamentName: string;
};

export function CloneTournamentButton({ tournamentId, tournamentName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/clone`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? 'Errore durante la clonazione.');
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      alert('Errore di rete.');
      setBusy(false);
    }
  }, [tournamentId, busy, router]);

  return (
    <button
      onClick={handleClick}
      title={`Crea una copia di "${tournamentName}"`}
      disabled={busy}
      style={{
        border: '1px solid var(--border)',
        background: 'white',
        color: 'var(--muted)',
        borderRadius: 10,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 700,
        cursor: busy ? 'wait' : 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      {busy ? 'Clonazione…' : 'Clona'}
    </button>
  );
}
