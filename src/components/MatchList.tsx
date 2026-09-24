'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Match, Participant, TournamentRules } from '@/lib/domain/types';
import { validateMatchResult } from '@/lib/domain/validators';
import { rulesForPhase } from '@/lib/domain/scoring';
import { phaseLabel, bracketLabel } from '@/lib/domain/labels';
import { isByeSide } from '@/lib/domain/calendar';
import { matchPhaseRank, mvpScopeThreshold, type MvpThrough } from '@/lib/domain/mvp';

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
  showTime?: boolean;
  mvpEnabled?: boolean;
  mvpThroughPhase?: string;
};

export function MatchList({ matches, participants, players = [], courtNames = {}, groupNames = {}, editable = false, tournamentId, rules, mvpVotes = [], showTime = true, mvpEnabled = true, mvpThroughPhase = 'FINAL' }: Props) {
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
            nameA={match.participantAId ? (name.get(match.participantAId) ?? match.participantAId) : (isByeSide(match, 'A') ? 'BYE' : 'In attesa')}
            nameB={match.participantBId ? (name.get(match.participantBId) ?? match.participantBId) : (isByeSide(match, 'B') ? 'BYE' : 'In attesa')}
            courtName={match.courtId ? (courtNames[match.courtId] ?? match.courtId) : undefined}
            groupNames={groupNames}
            editable={editable && ['SCHEDULED', 'IN_PROGRESS'].includes(match.status)}
            tournamentId={tournamentId}
            rules={rules}
            participants={participants}
            players={players}
            matchMvp={matchMvp.map((v) => ({ ...v, playerName: playerNameMap.get(v.playerId) ?? v.playerId }))}
            showTime={showTime}
            mvpEnabled={mvpEnabled}
            mvpThroughPhase={mvpThroughPhase}
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
  showTime: boolean;
  mvpEnabled: boolean;
  mvpThroughPhase: string;
};

function MatchCard({ match, nameA, nameB, courtName, groupNames = {}, editable, tournamentId, rules, participants, players, matchMvp, showTime, mvpEnabled, mvpThroughPhase }: CardProps) {
  const router = useRouter();
  const isCompleted = ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(match.status);
  const canEdit = editable || (!!tournamentId && !!rules && isCompleted);
  const mvpInScope = mvpEnabled && matchPhaseRank(match.phase) <= mvpScopeThreshold(mvpThroughPhase as MvpThrough);
  const hasBoth = Boolean(match.participantAId && match.participantBId);
  const eff = rules ? rulesForPhase(rules, match.phase) : null;
  const mode = eff?.scoringMode ?? 'SETS';
  const maxSets = eff?.setsPerMatch ?? 1;
  const existingMvp = matchMvp[0];
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ gamesA: number; gamesB: number }[]>(() =>
    match.sets.length ? match.sets.map((s) => ({ gamesA: s.gamesA, gamesB: s.gamesB })) : [{ gamesA: 0, gamesB: 0 }]
  );
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

  const setsPayload = (mode === 'SETS' ? rows.filter((r) => r.gamesA > 0 || r.gamesB > 0) : rows.slice(0, 1)).map((r, i) => ({
    setNumber: i + 1,
    gamesA: r.gamesA,
    gamesB: r.gamesB
  }));
  const winnerId = (() => {
    if (mode === 'SETS') {
      const sa = rows.filter((r) => r.gamesA > r.gamesB).length;
      const sb = rows.filter((r) => r.gamesB > r.gamesA).length;
      return sa > sb ? (match.participantAId ?? undefined) : sb > sa ? (match.participantBId ?? undefined) : undefined;
    }
    const a = rows[0]?.gamesA ?? 0;
    const b = rows[0]?.gamesB ?? 0;
    return a > b ? (match.participantAId ?? undefined) : b > a ? (match.participantBId ?? undefined) : undefined;
  })();
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
          mvpPlayerId: mvpInScope && mvpPlayerId ? mvpPlayerId : undefined,
          mvpRating: mvpInScope && mvpPlayerId ? mvpRating : undefined,
          mvpPenalty: mvpInScope && mvpPlayerId && mvpPenalty > 0 ? mvpPenalty : undefined,
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
        text: mode === 'SETS'
          ? `Risultato salvato: ${setsPayload.map((s) => `${s.gamesA}-${s.gamesB}`).join('  ')}`
          : `Risultato salvato: ${nameA} ${rows[0]?.gamesA ?? 0} - ${rows[0]?.gamesB ?? 0} ${nameB}`
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
        {match.bracket ? <span>{bracketLabel(match.bracket)}</span> : null}
        <span>{match.groupId ? (groupNames[match.groupId] ?? phaseLabel(match.phase)) : phaseLabel(match.phase)}</span>
        <span>Turno {match.roundIndex}</span>
        <span>{courtName ?? 'Campo da assegnare'}</span>
        {showTime ? <span>{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString('it-IT') : 'Orario da assegnare'}</span> : null}
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
              setRows(match.sets.length ? match.sets.map((s) => ({ gamesA: s.gamesA, gamesB: s.gamesB })) : [{ gamesA: 0, gamesB: 0 }]);
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
            {mode === 'SETS' ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 52, fontSize: 13, color: 'var(--muted)' }}>Set {idx + 1}</span>
                      <input type="number" min={0} value={row.gamesA} onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, gamesA: Number(e.target.value) } : r)))} style={{ width: 80 }} />
                      <span>–</span>
                      <input type="number" min={0} value={row.gamesB} onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, gamesB: Number(e.target.value) } : r)))} style={{ width: 80 }} />
                      {rows.length > 1 && (
                        <button type="button" className="button secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}>Rimuovi</button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="button secondary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={rows.length >= maxSets} onClick={() => setRows((prev) => [...prev, { gamesA: 0, gamesB: 0 }])}>+ Aggiungi set</button>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>massimo {maxSets} set · vince chi ne porta a casa di più</span>
                </div>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>{mode === 'GAMES_TARGET' ? `Game (target ${eff?.gamesPerSet ?? 0}) ` : 'Game '}{nameA}</label>
                  <input type="number" min={0} value={rows[0]?.gamesA ?? 0} onChange={(e) => setRows((prev) => [{ ...(prev[0] ?? { gamesA: 0, gamesB: 0 }), gamesA: Number(e.target.value) }])} />
                </div>
                <div className="field">
                  <label>{mode === 'GAMES_TARGET' ? `Game (target ${eff?.gamesPerSet ?? 0}) ` : 'Game '}{nameB}</label>
                  <input type="number" min={0} value={rows[0]?.gamesB ?? 0} onChange={(e) => setRows((prev) => [{ ...(prev[0] ?? { gamesA: 0, gamesB: 0 }), gamesB: Number(e.target.value) }])} />
                </div>
              </>
            )}
            {mvpInScope && (
              <>
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
              </>
            )}
          </div>
          {issues.length > 0 && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
              {issues.map((issue) => issue.message).join(' ')}
            </p>
          )}
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="button" disabled={issues.length > 0 || saving || !winnerId} onClick={handleSave}>
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
