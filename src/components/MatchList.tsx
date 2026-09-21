'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Match, Participant, TournamentRules } from '@/lib/domain/types';
import { validateMatchResult } from '@/lib/domain/validators';
import { phaseLabel } from '@/lib/domain/labels';

type MvpInfo = { matchId: string; playerId: string; rating: number; penalty?: number };

type Props = {
  matches: Match[];
  participants: Participant[];
  players?: { id: string; displayName: string }[];
  courtNames?: Record<string, string>;
  groupNames?: Record<string, string>;
  editable?: boolean;
  tournamentId?: string;
  rules?: TournamentRules;
  mvpVotes?: MvpInfo[];
};

export function MatchList({ matches, participants, players = [], courtNames = {}, groupNames = {}, editable = false, tournamentId, rules, mvpVotes = [] }: Props) {
  const name = new Map(participants.map((p) => [p.id, p.displayName]));
  const playerNameMap = new Map(players.map((p) => [p.id, p.displayName]));
  return (
    <div className="grid">
      {matches.map((match) => {
        const matchMvp = mvpVotes.filter((v) => v.matchId === match.id);
        return (
          <MatchCard
            key={match.id}
            match={match}
            nameA={name.get(match.participantAId ?? '') ?? match.participantAId ?? 'In attesa'}
            nameB={name.get(match.participantBId ?? '') ?? match.participantBId ?? 'In attesa'}
            courtName={match.courtId ? (courtNames[match.courtId] ?? match.courtId) : undefined}
            groupNames={groupNames}
            editable={editable && ['SCHEDULED', 'IN_PROGRESS'].includes(match.status)}
            tournamentId={tournamentId}
            rules={rules}
            participants={participants}
            players={players}
            matchMvp={matchMvp.map((v) => ({ ...v, playerName: playerNameMap.get(v.playerId) ?? v.playerId }))}
          />
        );
      })}
    </div>
  );
}

type CardProps = {
  match: Match;
  nameA: string;
  nameB: string;
  courtName?: string;
  groupNames?: Record<string, string>;
  editable: boolean;
  tournamentId?: string;
  rules?: TournamentRules;
  participants: Participant[];
  players: { id: string; displayName: string }[];
  matchMvp: { playerId: string; playerName: string; rating: number; penalty?: number }[];
};

function MatchCard({ match, nameA, nameB, courtName, groupNames = {}, editable, tournamentId, rules, participants, players, matchMvp }: CardProps) {
  const router = useRouter();
  const isCompleted = ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(match.status);
  const canEdit = editable || (!!tournamentId && !!rules && isCompleted);
  const hasBoth = Boolean(match.participantAId && match.participantBId);
  const mode = rules?.scoringMode ?? 'SETS';
  const existingSet = match.sets[0];
  const initialWinner: 'A' | 'B' | '' =
    match.winnerId && match.winnerId === match.participantBId ? 'B' : match.winnerId && match.winnerId === match.participantAId ? 'A' : '';
  const [open, setOpen] = useState(false);
  const [gamesA, setGamesA] = useState(existingSet?.gamesA ?? 0);
  const [gamesB, setGamesB] = useState(existingSet?.gamesB ?? 0);
  const [winnerChoice, setWinnerChoice] = useState<'A' | 'B' | ''>(mode === 'TIME' ? initialWinner : '');
  const existingMvp = matchMvp[0];
  const [mvpPlayerId, setMvpPlayerId] = useState(existingMvp?.playerId ?? '');
  const [mvpRating, setMvpRating] = useState(existingMvp?.rating ?? 8);
  const [mvpPenalty, setMvpPenalty] = useState(existingMvp?.penalty ?? 0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const playerNameMap = new Map(players.map((p) => [p.id, p.displayName]));
  const matchParticipants = participants.filter((p) => p.id === match.participantAId || p.id === match.participantBId);
  const matchPlayers = matchParticipants.flatMap((p) => p.playerIds.map((pid) => ({
    playerId: pid,
    label: playerNameMap.get(pid) ?? pid,
  })));

  const setsPayload = mode === 'TIME' ? [] : [{ setNumber: 1, gamesA, gamesB }];
  const winnerId =
    mode === 'TIME'
      ? (winnerChoice === 'A' ? match.participantAId ?? undefined : winnerChoice === 'B' ? match.participantBId ?? undefined : undefined)
      : (gamesA > gamesB ? match.participantAId ?? undefined : gamesB > gamesA ? match.participantBId ?? undefined : undefined);
  const preview: Match = rules ? { ...match, status: 'COMPLETED', sets: setsPayload, winnerId } : match;
  const issues = rules ? validateMatchResult(preview, rules) : [];
  const winnerDisplay =
    match.winnerId && match.winnerId === match.participantBId ? nameB : match.winnerId && match.winnerId === match.participantAId ? nameA : '';

  async function handleSave() {
    if (!tournamentId || !rules) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/matches/${match.id}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          sets: setsPayload,
          winnerId,
          mvpPlayerId: mvpPlayerId || undefined,
          mvpRating: mvpPlayerId ? mvpRating : undefined,
          mvpPenalty: mvpPlayerId && mvpPenalty > 0 ? mvpPenalty : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorText = body.issues
          ? body.issues.map((i: { message: string }) => i.message).join(' ')
          : body.error ?? `Errore (${res.status})`;
        throw new Error(errorText);
      }
      setMessage({
        type: 'success',
        text: mode === 'TIME'
          ? `Risultato salvato: vince ${winnerChoice === 'A' ? nameA : nameB}`
          : `Risultato salvato: ${nameA} ${gamesA} - ${gamesB} ${nameB}`
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Errore.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="match-card">
      <div className="match-meta">
        <span>{match.groupId ? (groupNames[match.groupId] ?? phaseLabel(match.phase)) : phaseLabel(match.phase)}</span>
        <span>Turno {match.roundIndex}</span>
        <span>{courtName ?? 'Campo da assegnare'}</span>
        <span>{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString('it-IT') : 'Orario da assegnare'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <strong>{nameA}</strong> vs <strong>{nameB}</strong>
        </div>
        {canEdit && hasBoth && !open && !isCompleted && (
          <button
            className="button"
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => setOpen(true)}
          >
            Inserisci risultato
          </button>
        )}
        {canEdit && !open && isCompleted && (
          <button
            className="button secondary"
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => {
              setGamesA(existingSet?.gamesA ?? 0);
              setGamesB(existingSet?.gamesB ?? 0);
              setWinnerChoice(mode === 'TIME' ? initialWinner : '');
              setMvpPlayerId(existingMvp?.playerId ?? '');
              setMvpRating(existingMvp?.rating ?? 8);
              setMvpPenalty(existingMvp?.penalty ?? 0);
              setOpen(true);
            }}
          >
            Modifica risultato
          </button>
        )}
      </div>
      <div className="score">
        {match.sets.length
          ? match.sets.map((set) => `${set.gamesA}-${set.gamesB}`).join(' ')
          : winnerDisplay
            ? `Vince: ${winnerDisplay}`
            : match.status}
      </div>
      {!hasBoth && !isCompleted && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>In attesa di definire gli avversari</div>
      )}
      {matchMvp.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--accent)' }}>
          {matchMvp.map((v, i) => (
            <span key={i}>MVP: <strong>{v.playerName}</strong> (voto {v.rating}{v.penalty ? `, penalità ${v.penalty}` : ''})</span>
          ))}
        </div>
      )}

      {message && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#b91c1c',
          fontSize: 13,
        }}>
          {message.text}
        </div>
      )}

      {open && rules && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
          <div className="form-grid">
            {mode === 'TIME' ? (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Coppia vincente</label>
                <select value={winnerChoice} onChange={(e) => setWinnerChoice(e.target.value as 'A' | 'B' | '')}>
                  <option value="">Seleziona…</option>
                  <option value="A">{nameA}</option>
                  <option value="B">{nameB}</option>
                </select>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>{mode === 'GAMES_TARGET' ? 'Punti ' : 'Game '}{nameA.split(/[\/\s]/)[0]}</label>
                  <input type="number" min={0} value={gamesA} onChange={(e) => setGamesA(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>{mode === 'GAMES_TARGET' ? 'Punti ' : 'Game '}{nameB.split(/[\/\s]/)[0]}</label>
                  <input type="number" min={0} value={gamesB} onChange={(e) => setGamesB(Number(e.target.value))} />
                </div>
              </>
            )}
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
            <div className="field">
              <label>Penalità MVP</label>
              <input type="number" min={0} max={10} step={0.5} value={mvpPenalty} onChange={(e) => setMvpPenalty(Number(e.target.value))} />
            </div>
          </div>
          {issues.length > 0 && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
              {issues.map((issue) => issue.message).join(' ')}
            </p>
          )}
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="button" disabled={issues.length > 0 || saving || (mode === 'TIME' ? !winnerChoice : (gamesA === 0 && gamesB === 0))} onClick={handleSave}>
              {saving ? 'Salvataggio...' : 'Salva risultato'}
            </button>
            <button className="button secondary" onClick={() => { setOpen(false); setMessage(null); }}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
