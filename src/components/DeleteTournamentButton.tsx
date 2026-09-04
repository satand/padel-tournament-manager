'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  tournamentId: string;
  tournamentName: string;
  redirectTo?: string;
};

export function DeleteTournamentButton({ tournamentId, tournamentName, redirectTo }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const confirmReadyRef = useRef(false);

  useEffect(() => {
    if (phase === 'confirm') {
      confirmReadyRef.current = false;
      const timer = setTimeout(() => { confirmReadyRef.current = true; }, 300);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleFirstClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhase('confirm');
  }, []);

  const handleConfirm = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmReadyRef.current) return;

    setPhase('deleting');
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? 'Errore durante l\'eliminazione.');
        setPhase('idle');
        return;
      }
      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        router.refresh();
        setPhase('idle');
      }
    } catch {
      alert('Errore di rete.');
      setPhase('idle');
    }
  }, [tournamentId, redirectTo, router]);

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhase('idle');
  }, []);

  if (phase === 'confirm' || phase === 'deleting') {
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>
          Eliminare &quot;{tournamentName}&quot;?
        </span>
        <button
          onClick={handleConfirm}
          disabled={phase === 'deleting'}
          style={{
            border: 'none',
            background: 'var(--danger)',
            color: 'white',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: phase === 'deleting' ? 'wait' : 'pointer',
          }}
        >
          {phase === 'deleting' ? 'Eliminazione...' : 'Si, elimina'}
        </button>
        <button
          onClick={handleCancel}
          disabled={phase === 'deleting'}
          style={{
            border: '1px solid var(--border)',
            background: 'white',
            color: 'var(--muted)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Annulla
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleFirstClick}
      title="Elimina torneo"
      style={{
        border: '1px solid var(--border)',
        background: 'white',
        color: 'var(--danger)',
        borderRadius: 10,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      Elimina
    </button>
  );
}
