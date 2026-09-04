'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ParticipantInfo = { id: string; displayName: string };

type Props = {
  tournamentId: string;
  participantType: string;
  participantsCount: number;
  matchesCount: number;
  participantsList: ParticipantInfo[];
};

export function TournamentActions({ tournamentId, participantType, participantsCount, matchesCount, participantsList }: Props) {
  const router = useRouter();
  const [participants, setParticipants] = useState('');
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleAddParticipants() {
    const lines = participants.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setMessage({ type: 'error', text: 'Inserisci almeno un partecipante.' });
      return;
    }

    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: lines }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Errore (${res.status})`);
      }
      const data = await res.json();
      setMessage({ type: 'success', text: `${data.count} partecipant${data.count === 1 ? 'e' : 'i'} aggiunti.` });
      setParticipants('');
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Errore.' });
    } finally {
      setAdding(false);
    }
  }

  async function handleGenerate(regenerate = false) {
    setGenerating(true);
    setMessage(null);
    setConfirmRegenerate(false);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Errore (${res.status})`);
      }
      const data = await res.json();
      setMessage({ type: 'success', text: `Calendario ${regenerate ? 'rigenerato' : 'generato'}: ${data.matchesCreated} partite create.` });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Errore.' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteParticipant(participantId: string) {
    setDeletingId(participantId);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/participants?participantId=${participantId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Errore (${res.status})`);
      }
      setMessage({ type: 'success', text: 'Partecipante eliminato.' });
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Errore.' });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="panel">
      <h2>Gestisci torneo</h2>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#b91c1c',
          marginBottom: 16,
        }}>
          {message.text}
        </div>
      )}

      <div className="grid grid-2">
        <div>
          <h3>Partecipanti attuali ({participantsList.length})</h3>
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {participantsList.length > 0 ? participantsList.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)', fontSize: 14 }}>
                <span>{p.displayName}</span>
                {confirmDeleteId === p.id ? (
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      onClick={() => handleDeleteParticipant(p.id)}
                      disabled={deletingId === p.id}
                      style={{ border: 'none', background: 'var(--danger)', color: 'white', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {deletingId === p.id ? '...' : 'Conferma'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--muted)', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Annulla
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(p.id)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '3px 8px' }}
                  >
                    Elimina
                  </button>
                )}
              </div>
            )) : (
              <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0' }}>Nessun partecipante inserito.</p>
            )}
          </div>
        </div>

        <div>
          <h3>Aggiungi partecipanti</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
            {participantType === 'TEAM'
              ? 'Una coppia per riga, separando i nomi con / (es. "Marco Rossi / Luca Bianchi")'
              : 'Un giocatore per riga (es. "Marco Rossi")'}
          </p>
          <textarea
            rows={6}
            placeholder={participantType === 'TEAM'
              ? 'Marco Rossi / Luca Bianchi\nDavide Ferrari / Andrea Gallo\nPaolo Neri / Enrico Conti'
              : 'Marco Rossi\nLuca Bianchi\nDavide Ferrari'}
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: 12, fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
          />
          <div className="actions">
            <button className="button" disabled={adding || !participants.trim()} onClick={handleAddParticipants}>
              {adding ? 'Aggiunta in corso...' : 'Aggiungi partecipanti'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Genera calendario</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
            Genera automaticamente le partite in base al formato del torneo e ai partecipanti inseriti.
          </p>
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="stat"><div className="stat-label">Partecipanti attuali</div><div className="stat-value">{participantsCount}</div></div>
            <div className="stat"><div className="stat-label">Partite generate</div><div className="stat-value">{matchesCount}</div></div>
          </div>
          <div className="actions">
            {matchesCount === 0 && (
              <button
                className="button"
                disabled={generating || participantsCount < 2}
                onClick={() => handleGenerate(false)}
              >
                {generating ? 'Generazione in corso...' : 'Genera calendario'}
              </button>
            )}
            {matchesCount > 0 && !confirmRegenerate && (
              <button
                className="button secondary"
                disabled={generating || participantsCount < 2}
                onClick={() => setConfirmRegenerate(true)}
              >
                Rigenera calendario
              </button>
            )}
            {matchesCount > 0 && confirmRegenerate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>
                  Le {matchesCount} partite e i risultati saranno eliminati. Continuare?
                </span>
                <button
                  className="button"
                  disabled={generating}
                  style={{ background: 'var(--danger)', padding: '6px 14px', fontSize: 13 }}
                  onClick={() => handleGenerate(true)}
                >
                  {generating ? 'Rigenerazione...' : 'Sì, rigenera'}
                </button>
                <button
                  className="button secondary"
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => setConfirmRegenerate(false)}
                >
                  Annulla
                </button>
              </span>
            )}
          </div>
          {participantsCount < 2 && matchesCount === 0 && (
            <p style={{ color: 'var(--warning)', fontSize: 13, marginTop: 8 }}>Servono almeno 2 partecipanti.</p>
          )}
      </div>
    </section>
  );
}
