'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Match, Participant, TournamentRules } from '@/lib/domain/types';
import { validateMatchResult } from '@/lib/domain/validators';

type Props = {
  match: Match;
  participants: Participant[];
  players: { id: string; displayName: string }[];
  rules: TournamentRules;
  tournamentId: string;
  courtNames?: Record<string, string>;
};

export function ResultEntry({ match, participants, players, rules, tournamentId, courtNames = {} }: Props) {
  const router = useRouter();
  const nameA = participants.find((p) => p.id === match.participantAId)?.displayName ?? match.participantAId;
  const nameB = participants.find((p) => p.id === match.participantBId)?.displayName ?? match.participantBId;

  const [gamesA, setGamesA] = useState(0);
  const [gamesB, setGamesB] = useState(0);
  const [mvpPlayerId, setMvpPlayerId] = useState('');
  const [mvpRating, setMvpRating] = useState(8);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const playerNameMap = new Map(players.map((p) => [p.id, p.displayName]));
  const matchParticipants = participants.filter((p) => p.id === match.participantAId || p.id === match.participantBId);
  const matchPlayers = matchParticipants.flatMap((p) => p.playerIds.map((pid) => ({
    playerId: pid,
    label: playerNameMap.get(pid) ?? pid,
  })));

  const preview: Match = { ...match, status: 'COMPLETED', sets: [{ setNumber: 1, gamesA, gamesB }] };
  const issues = validateMatchResult(preview, rules);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/matches/${match.id}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          sets: [{ setNumber: 1, gamesA, gamesB }],
          winnerId: gamesA > gamesB ? match.participantAId : match.participantBId,
          mvpPlayerId: mvpPlayerId || undefined,
          mvpRating: mvpPlayerId ? mvpRating : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorText = body.issues
          ? body.issues.map((i: { message: string }) => i.message).join(' ')
          : body.error ?? `Errore (${res.status})`;
        throw new Error(errorText);
      }
      setMessage({ type: 'success', text: `Risultato salvato: ${nameA} ${gamesA} - ${gamesB} ${nameB}` });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Errore.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Inserimento risultato rapido</h2>
      <div style={{ padding: '12px 16px', borderRadius: 12, background: '#f0f9ff', border: '1px solid #bae6fd', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          <strong>{nameA}</strong> vs <strong>{nameB}</strong>
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
          {match.phase ?? 'fase'} · Turno {match.roundIndex ?? 1}
          {match.courtId && ` · ${courtNames[match.courtId] ?? match.courtId}`}
          {match.scheduledAt && ` · ${new Date(match.scheduledAt).toLocaleString('it-IT')}`}
        </p>
      </div>

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

      <div className="form-grid">
        <div className="field">
          <label>Game {nameA.split(/[\/\s]/)[0]}</label>
          <input type="number" min={0} value={gamesA} onChange={(e) => setGamesA(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Game {nameB.split(/[\/\s]/)[0]}</label>
          <input type="number" min={0} value={gamesB} onChange={(e) => setGamesB(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>MVP partita</label>
          <select value={mvpPlayerId} onChange={(e) => setMvpPlayerId(e.target.value)}>
            <option value="">Non assegnato</option>
            {matchPlayers.map((opt) => <option key={opt.playerId} value={opt.playerId}>{opt.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Voto MVP</label>
          <input type="number" min={1} max={10} step={0.1} value={mvpRating} onChange={(e) => setMvpRating(Number(e.target.value))} />
        </div>
      </div>

      {issues.length > 0 && (
        <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
          {issues.map((issue) => issue.message).join(' ')}
        </p>
      )}

      <div className="actions">
        <button className="button" disabled={issues.length > 0 || saving || (gamesA === 0 && gamesB === 0)} onClick={handleSave}>
          {saving ? 'Salvataggio...' : 'Salva risultato'}
        </button>
      </div>
    </div>
  );
}
