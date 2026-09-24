'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TournamentSettings } from '@prisma/client';

type ParticipantRow = { id: string; displayName: string; level: number | null; players: { id: string; name: string }[] };
type GroupRow = { id: string; name: string };

type Props = {
  tournamentId: string;
  status: string;
  startsAt: string | null;
  participants: ParticipantRow[];
  matchesCount: number;
  groups: GroupRow[];
  settings: TournamentSettings | null;
  finalsCount: number;
  groupMatchesTotal: number;
  groupMatchesDone: number;
  groupsConcluded: boolean;
  qualifiedCount: number;
  finalsCompleted: boolean;
};

type CoupleForm = { participantId: string | null; player1: string; player2: string; level: string };
const emptyCouple: CoupleForm = { participantId: null, player1: '', player2: '', level: '1' };

function toInputDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const FINAL_ROUND_LABELS: Record<string, string> = {
  FINAL: 'Solo finale', SF: 'Semifinali', QF: 'Quarti', R8: 'Ottavi', R16: 'Sedicesimi'
};
const FINAL_ROUND_SIZE: Record<string, number> = { FINAL: 2, SF: 4, QF: 8, R8: 16, R16: 32 };
function roundOptions(minEntrants: number, current: string): string[] {
  const keys = Object.keys(FINAL_ROUND_SIZE).filter((r) => FINAL_ROUND_SIZE[r] >= minEntrants || r === current);
  return keys.sort((a, b) => FINAL_ROUND_SIZE[a] - FINAL_ROUND_SIZE[b]);
}
const roundLabel = (r: string) => `${FINAL_ROUND_LABELS[r] ?? r} (${FINAL_ROUND_SIZE[r] ?? '?'})`;
const SectionDivider = () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '22px 0' }} />;

export function TournamentActions({ tournamentId, status, startsAt, participants, matchesCount, groups, settings, finalsCount, groupMatchesTotal, groupMatchesDone, groupsConcluded, qualifiedCount, finalsCompleted }: Props) {
  const router = useRouter();
  const [couple, setCouple] = useState<CoupleForm>(emptyCouple);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingFinals, setGeneratingFinals] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmRegenFinals, setConfirmRegenFinals] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [calendario, setCalendario] = useState({
    courtsCount: settings?.courtsCount ?? 2,
    warmUpMinutes: settings?.warmUpMinutes ?? 5,
    matchDurationMinutes: settings?.matchDurationMinutes ?? 30,
    changeoverMinutes: settings?.changeoverMinutes ?? 15
  });
  const [maxMatchesPerDay, setMaxMatchesPerDay] = useState<number>(settings?.maxMatchesPerPlayerDay ?? 6);
  const [maxMatchesUnlimited, setMaxMatchesUnlimited] = useState(settings?.maxMatchesPerPlayerDay == null);
  const [savingCal, setSavingCal] = useState(false);
  const [startDate, setStartDate] = useState(toInputDate(startsAt));
  const [savingDate, setSavingDate] = useState(false);

  const [presentSlideSeconds, setPresentSlideSeconds] = useState<number | ''>(settings?.presentSlideSeconds ?? 6);
  const [savingProj, setSavingProj] = useState(false);

  const [savingStruct, setSavingStruct] = useState(false);
  const structPoints = (settings?.scoreRules ?? {}) as { win?: number; loss?: number };
  const [struct, setStruct] = useState<{
    scoringMode: string; targetGames: number;
    finalScoringMode: string; finalMaxSets: number; finalGamesPerSet: number; finalTargetGames: number;
    groupCount: number; qualifiedPerGroup: number; finalStartRound: string;
    finalStartRoundGold: string; finalStartRoundSilver: string; qualifiedForGold: number;
    splitGoldSilver: boolean; mvpEnabled: boolean; mvpThroughPhase: string;
    pointsWin: number; pointsLoss: number;
  }>({
    scoringMode: settings?.scoringMode === 'SETS' ? 'GAMES_TARGET' : (settings?.scoringMode ?? 'GAMES_TARGET'),
    targetGames: settings?.targetGames ?? 21,
    finalScoringMode: settings?.finalScoringMode ?? '',
    finalMaxSets: settings?.finalSetsPerMatch ?? 3,
    finalGamesPerSet: settings?.finalGamesPerSet ?? 6,
    finalTargetGames: settings?.finalTargetGames ?? 21,
    groupCount: settings?.groupCount ?? 2,
    qualifiedPerGroup: settings?.qualifiedPerGroup ?? 2,
    finalStartRound: settings?.finalStartRound ?? 'FINAL',
    finalStartRoundGold: settings?.finalStartRoundGold ?? '',
    finalStartRoundSilver: settings?.finalStartRoundSilver ?? '',
    qualifiedForGold: settings?.qualifiedForGold ?? (qualifiedCount >= 4 ? Math.floor(qualifiedCount / 2) : Math.max(2, qualifiedCount)),
    splitGoldSilver: settings?.splitGoldSilver ?? true,
    mvpEnabled: settings?.mvpEnabled ?? true,
    mvpThroughPhase: settings?.mvpThroughPhase ?? 'GROUP',
    pointsWin: structPoints.win ?? 3,
    pointsLoss: structPoints.loss ?? 0
  });

  const finalsEditable = groupsConcluded && finalsCount === 0;
  const rosterLocked = matchesCount > 0;
  const gsAllowed = qualifiedCount >= 4;
  const gsMode = struct.splitGoldSilver && gsAllowed;
  const goldCount = gsAllowed ? Math.min(qualifiedCount - 2, Math.max(2, Math.trunc(struct.qualifiedForGold) || 2)) : qualifiedCount;
  const silverCount = Math.max(0, qualifiedCount - goldCount);

  function setMessageLater(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
  }

  function startEdit(p: ParticipantRow) {
    setCouple({
      participantId: p.id,
      player1: p.players[0]?.name ?? '',
      player2: p.players[1]?.name ?? '',
      level: p.level != null ? String(p.level) : '1'
    });
  }

  async function saveCouple() {
    if (!couple.player1.trim() || !couple.player2.trim()) {
      setMessageLater('error', 'Inserisci entrambi i giocatori della coppia.');
      return;
    }
    const levelNum = Number(couple.level);
    if (!couple.level.trim() || !Number.isFinite(levelNum) || levelNum < 0 || levelNum > 10) {
      setMessageLater('error', 'Imposta un livello valido (0–10) per la coppia.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const payload = {
      player1: couple.player1.trim(),
      player2: couple.player2.trim(),
      level: levelNum
    };
    try {
      const res = couple.participantId
        ? await fetch(`/api/tournaments/${tournamentId}/participants`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId: couple.participantId, ...payload })
          })
        : await fetch(`/api/tournaments/${tournamentId}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ couples: [payload] })
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Errore nel salvataggio della coppia.');
      }
      setMessageLater('success', couple.participantId ? 'Coppia aggiornata.' : 'Coppia aggiunta.');
      setCouple(emptyCouple);
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCouple(participantId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/participants?participantId=${participantId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Errore nell\'eliminazione.');
      }
      setMessageLater('success', 'Coppia eliminata.');
      setConfirmDeleteId(null);
      if (couple.participantId === participantId) setCouple(emptyCouple);
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCalendario() {
    setSavingCal(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...calendario, maxMatchesPerPlayerDay: maxMatchesUnlimited ? null : maxMatchesPerDay })
      });
      if (!res.ok) throw new Error('Impossibile salvare il calendario.');
      setMessageLater('success', 'Impostazioni calendario salvate.');
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setSavingCal(false);
    }
  }

  async function saveDate() {
    setSavingDate(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startsAt: startDate ? new Date(startDate).toISOString() : null })
      });
      if (!res.ok) throw new Error('Impossibile salvare la data di inizio.');
      setMessageLater('success', 'Data di inizio salvata.');
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setSavingDate(false);
    }
  }

  async function saveProiezione() {
    const n = typeof presentSlideSeconds === 'number' ? presentSlideSeconds : NaN;
    if (!Number.isFinite(n)) {
      setMessageLater('error', 'Inserisci un numero di secondi valido (2–120).');
      return;
    }
    const clamped = Math.min(120, Math.max(2, Math.trunc(n)));
    setSavingProj(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentSlideSeconds: clamped })
      });
      if (!res.ok) throw new Error('Impossibile salvare il tempo di proiezione.');
      setPresentSlideSeconds(clamped);
      setMessageLater('success', 'Tempo di cambio slide salvato.');
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setSavingProj(false);
    }
  }

  async function saveStruct() {
    setSavingStruct(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoringMode: struct.scoringMode,
          targetGames: struct.targetGames,
          finalScoringMode: struct.finalScoringMode || null,
          finalMaxSets: struct.finalScoringMode ? struct.finalMaxSets : null,
          finalGamesPerSet: struct.finalScoringMode ? struct.finalGamesPerSet : null,
          finalTargetGames: struct.finalScoringMode ? struct.finalTargetGames : null,
          groupCount: struct.groupCount,
          qualifiedPerGroup: struct.qualifiedPerGroup,
          finalStartRound: struct.finalStartRound,
          finalStartRoundGold: struct.finalStartRoundGold || null,
          finalStartRoundSilver: struct.finalStartRoundSilver || null,
          qualifiedForGold: struct.splitGoldSilver ? struct.qualifiedForGold : null,
          splitGoldSilver: struct.splitGoldSilver,
          mvpEnabled: struct.mvpEnabled,
          mvpThroughPhase: struct.mvpThroughPhase,
          pointsWin: struct.pointsWin,
          pointsLoss: struct.pointsLoss
        })
      });
      if (!res.ok) throw new Error('Impossibile salvare le impostazioni strutturali.');
      setMessageLater('success', 'Impostazioni strutturali salvate.');
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setSavingStruct(false);
    }
  }

  async function handleGenerate(regenerate = false) {
    setGenerating(true);
    setMessage(null);
    setConfirmRegenerate(false);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regenerate }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Errore nella generazione.');
      setMessageLater('success', `Calendario generato: ${data.matchesCreated} partite, ${data.groupsCreated} gironi.`);
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateFinals(regenerate = false) {
    setGeneratingFinals(true);
    setMessage(null);
    setConfirmRegenFinals(false);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/generate-finals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regenerate }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Errore nella generazione della fase finale.');
      setMessageLater('success', `Fase finale generata: ${data.matchesCreated} partite.`);
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setGeneratingFinals(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    setMessage(null);
    setConfirmClose(false);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/close`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Errore nella chiusura del torneo.');
      setMessageLater('success', 'Torneo chiuso: non è più modificabile.');
      router.refresh();
    } catch (err) {
      setMessageLater('error', err instanceof Error ? err.message : 'Errore.');
    } finally {
      setClosing(false);
    }
  }

  const inputStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: 10, fontFamily: 'inherit', fontSize: 14 } as const;
  const editing = Boolean(couple.participantId);

  return (
    <section className="panel">
      <h2>Gestisci torneo</h2>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: message.type === 'success' ? '#166534' : '#b91c1c', marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      <div>
        <h3>Dati torneo</h3>
        <div className="form-grid">
          <div className="field">
            <label>Data inizio</label>
            {status === 'DRAFT' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ flex: '1 1 220px', minWidth: 0 }} />
                <button className="button secondary" disabled={savingDate} onClick={saveDate} style={{ flexShrink: 0 }}>{savingDate ? 'Salvataggio...' : 'Salva data'}</button>
              </div>
            ) : (
              <>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: '#f8fafc', fontSize: 14 }}>
                  {startsAt ? new Date(startsAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Non impostata'}
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Modificabile solo quando il torneo è in bozza.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <SectionDivider />
      <div>
        <h3>Schermo di proiezione</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Secondi di permanenza di ogni slide nel carosello della schermata di proiezione (2–120).</p>
        <div className="form-grid">
          <div className="field"><label>Cambio automatico slide (secondi)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="number" min={2} max={120} value={presentSlideSeconds} onChange={(e) => setPresentSlideSeconds(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inputStyle, flex: '1 1 140px', minWidth: 0 }} />
              <button className="button secondary" disabled={savingProj} onClick={saveProiezione} style={{ flexShrink: 0 }}>{savingProj ? 'Salvataggio...' : 'Salva proiezione'}</button>
            </div>
          </div>
        </div>
      </div>

      <SectionDivider />
      <div className="grid grid-2">
        <div>
          <h3>{rosterLocked ? 'Coppie' : editing ? 'Modifica coppia' : 'Aggiungi coppia'}</h3>
          {rosterLocked ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: '#f8fafc' }}>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Anagrafica bloccata: il calendario è già stato generato ({matchesCount} partite). Le squadre iscritte non sono più modificabili. Crea un nuovo torneo per un elenco diverso.</p>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <div className="field">
                  <label>Giocatore 1</label>
                  <input placeholder="Nome e cognome" value={couple.player1} onChange={(e) => setCouple({ ...couple, player1: e.target.value })} />
                </div>
                <div className="field">
                  <label>Giocatore 2</label>
                  <input placeholder="Nome e cognome" value={couple.player2} onChange={(e) => setCouple({ ...couple, player2: e.target.value })} />
                </div>
                <div className="field">
                  <label>Livello (obbligatorio, 0–10, 2 decimali)</label>
                  <input type="number" min={0} max={10} step={0.01} required value={couple.level} onChange={(e) => setCouple({ ...couple, level: e.target.value })} />
                </div>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Il nome della squadra è generato automaticamente dai cognomi (es. "Rossi / Bianchi").</p>
              <div className="actions">
                <button className="button" disabled={busy} onClick={saveCouple}>{busy ? 'Salvataggio...' : editing ? 'Salva modifiche' : 'Aggiungi coppia'}</button>
                {editing && <button className="button secondary" onClick={() => setCouple(emptyCouple)}>Annulla modifica</button>}
              </div>
            </>
          )}
        </div>

        <div>
          {rosterLocked ? (
            <details style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', padding: '10px 12px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>Coppie iscritte ({participants.length})</summary>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {participants.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0' }}>Nessuna coppia inserita.</p>}
                {participants.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)', fontSize: 14 }}>
                    <span style={{ minWidth: 0 }}>
                      <strong>{p.displayName}</strong>
                      {p.level != null && <span style={{ color: 'var(--muted)' }}> · liv. {p.level}</span>}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>Anagrafica bloccata: squadre non modificabili, in ordine di iscrizione.</p>
            </details>
          ) : (
            <>
              <h3>Coppie iscritte ({participants.length})</h3>
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {participants.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0' }}>Nessuna coppia inserita.</p>}
                {participants.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)', fontSize: 14 }}>
                    <span style={{ minWidth: 0 }}>
                      <strong>{p.displayName}</strong>
                      {p.level != null && <span style={{ color: 'var(--muted)' }}> · liv. {p.level}</span>}
                    </span>
                    {!rosterLocked && (
                      <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => startEdit(p)} style={{ border: '1px solid var(--border)', background: 'white', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Modifica</button>
                        {confirmDeleteId === p.id ? (
                          <>
                            <button onClick={() => deleteCouple(p.id)} disabled={busy} style={{ border: 'none', background: 'var(--danger)', color: 'white', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Conferma</button>
                            <button onClick={() => setConfirmDeleteId(null)} style={{ border: '1px solid var(--border)', background: 'white', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>No</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(p.id)} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '3px 8px' }}>Elimina</button>
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <SectionDivider />
      <div>
        <h3>Impostazioni strutturali</h3>
        {status === 'DRAFT' && !finalsEditable && (
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0' }}>Le impostazioni della fase finale si sbloccano al termine della fase a gironi.</p>
        )}

        <div style={{ marginTop: 8 }}>
          <h4>Impostazioni Generali</h4>
          {status !== 'DRAFT' ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Bloccate dopo la generazione del calendario.</p>
          ) : (
            <div className="form-grid">
              <div className="field"><label>Punti vittoria</label><input type="number" value={struct.pointsWin} onChange={(e) => setStruct({ ...struct, pointsWin: Number(e.target.value) })} /></div>
              <div className="field"><label>Punti sconfitta</label><input type="number" value={struct.pointsLoss} onChange={(e) => setStruct({ ...struct, pointsLoss: Number(e.target.value) })} /></div>
              <div className="field"><label>MVP attivo</label>
                <select value={struct.mvpEnabled ? 'si' : 'no'} onChange={(e) => setStruct({ ...struct, mvpEnabled: e.target.value === 'si' })}><option value="si">Sì</option><option value="no">No</option></select>
              </div>
              <div className="field"><label>Conta MVP fino a</label>
                <select value={struct.mvpThroughPhase} onChange={(e) => setStruct({ ...struct, mvpThroughPhase: e.target.value })}>
                  <option value="GROUP">Solo gironi</option><option value="R16">Sedicesimi</option><option value="R8">Ottavi</option><option value="QF">Quarti</option><option value="SF">Semifinali</option><option value="FINAL">Finale</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <h4>Impostazioni Fase a Gironi</h4>
          {status !== 'DRAFT' ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Bloccate dopo la generazione del calendario.</p>
          ) : (
            <div className="form-grid">
              <div className="field"><label>Numero di gironi</label><input type="number" min={1} value={struct.groupCount} onChange={(e) => setStruct({ ...struct, groupCount: Number(e.target.value) })} /></div>
              <div className="field"><label>Modalità punteggio</label>
                <select value={struct.scoringMode} onChange={(e) => setStruct({ ...struct, scoringMode: e.target.value })}>
                  <option value="GAMES_TARGET">A target (primo a N game)</option>
                  <option value="TIME">A tempo</option>
                </select>
              </div>
              {struct.scoringMode === 'GAMES_TARGET' && (
                <div className="field"><label>Game da raggiungere</label><input type="number" min={1} value={struct.targetGames} onChange={(e) => setStruct({ ...struct, targetGames: Number(e.target.value) })} /></div>
              )}
              <div className="field"><label>Qualificati per girone</label><input type="number" min={1} value={struct.qualifiedPerGroup} onChange={(e) => setStruct({ ...struct, qualifiedPerGroup: Number(e.target.value) })} /></div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <h4>Impostazioni Fase Finale</h4>
          {finalsCount > 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Fase finale già generata: per modificare queste opzioni rigenera i tabelloni.</p>
          ) : !groupsConcluded ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Disponibile al termine della fase a gironi (chiudi tutte le partite dei gironi).</p>
          ) : (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 8px' }}>{qualifiedCount} squadre qualificate dai gironi. Gold/Silver e dimensione dei tabelloni sono scelti in base al numero reale di qualificate.</p>
              <div className="form-grid">
                <div className="field"><label>Tabelloni</label>
                  <select value={gsMode ? 'gs' : 'single'} disabled={!gsAllowed} onChange={(e) => setStruct({ ...struct, splitGoldSilver: e.target.value === 'gs' })}>
                    <option value="gs">Gold + Silver</option>
                    <option value="single">Tabellone unico</option>
                  </select>
                  {!gsAllowed && <span style={{ color: 'var(--muted)', fontSize: 11 }}>Gold + Silver richiede almeno 4 qualificate.</span>}
                </div>

                {!gsMode ? (
                  <div className="field"><label>Fase finale da</label>
                    <select value={FINAL_ROUND_SIZE[struct.finalStartRound] >= qualifiedCount ? struct.finalStartRound : (roundOptions(qualifiedCount, '')[0] ?? 'FINAL')} onChange={(e) => setStruct({ ...struct, finalStartRound: e.target.value })}>
                      {roundOptions(qualifiedCount, struct.finalStartRound).map((r) => <option key={r} value={r}>{roundLabel(r)}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="field"><label>Squadre nel tabellone Gold</label>
                      <input type="number" min={2} max={qualifiedCount - 2} value={goldCount} onChange={(e) => setStruct({ ...struct, qualifiedForGold: Number(e.target.value) })} />
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{goldCount} in Gold, {silverCount} in Silver (restanti). Le migliori {goldCount} del ranking globale vanno in Gold.</span>
                    </div>
                    <div className="field"><label>Gold · Fase finale da</label>
                      <select value={struct.finalStartRoundGold} onChange={(e) => setStruct({ ...struct, finalStartRoundGold: e.target.value })}>
                        <option value="">Automatico (minimo)</option>
                        {roundOptions(goldCount, struct.finalStartRoundGold).map((r) => <option key={r} value={r}>{roundLabel(r)}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Silver · Fase finale da</label>
                      <select value={struct.finalStartRoundSilver} onChange={(e) => setStruct({ ...struct, finalStartRoundSilver: e.target.value })}>
                        <option value="">Automatico (minimo)</option>
                        {roundOptions(Math.max(2, silverCount), struct.finalStartRoundSilver).map((r) => <option key={r} value={r}>{roundLabel(r)}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="field"><label>Modalità punteggio fase finale</label>
                  <select value={struct.finalScoringMode} onChange={(e) => setStruct({ ...struct, finalScoringMode: e.target.value })}>
                    <option value="">Uguale ai gironi</option>
                    <option value="SETS">Set (al meglio di N)</option>
                    <option value="GAMES_TARGET">A target (primo a N game)</option>
                    <option value="TIME">A tempo</option>
                  </select>
                </div>
                {struct.finalScoringMode === 'SETS' && (
                  <>
                    <div className="field"><label>Set al meglio di</label><input type="number" min={1} max={3} value={struct.finalMaxSets} onChange={(e) => setStruct({ ...struct, finalMaxSets: Number(e.target.value) })} /></div>
                    <div className="field"><label>Game per set</label><input type="number" min={1} value={struct.finalGamesPerSet} onChange={(e) => setStruct({ ...struct, finalGamesPerSet: Number(e.target.value) })} /></div>
                  </>
                )}
                {struct.finalScoringMode === 'GAMES_TARGET' && (
                  <div className="field"><label>Game da raggiungere</label><input type="number" min={1} value={struct.finalTargetGames} onChange={(e) => setStruct({ ...struct, finalTargetGames: Number(e.target.value) })} /></div>
                )}
              </div>
            </>
          )}
        </div>

        {(status === 'DRAFT' || finalsEditable) && (
          <div className="actions"><button className="button secondary" disabled={savingStruct} onClick={saveStruct}>{savingStruct ? 'Salvataggio...' : 'Salva impostazioni'}</button></div>
        )}
      </div>

      <SectionDivider />
      <div>
        <h3>Calendario</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Parametri applicati alla generazione. Puoi modificarli e rigenerare in qualsiasi momento (i risultati vanno persi solo se rigeneri).</p>
        <div className="form-grid">
          <div className="field"><label>Nº campi</label><input type="number" min={1} value={calendario.courtsCount} onChange={(e) => setCalendario({ ...calendario, courtsCount: Number(e.target.value) })} style={inputStyle} /></div>
          <div className="field"><label>Riscaldamento (min)</label><input type="number" min={0} value={calendario.warmUpMinutes} onChange={(e) => setCalendario({ ...calendario, warmUpMinutes: Number(e.target.value) })} style={inputStyle} /></div>
          <div className="field"><label>Durata match (min)</label><input type="number" min={5} value={calendario.matchDurationMinutes} onChange={(e) => setCalendario({ ...calendario, matchDurationMinutes: Number(e.target.value) })} style={inputStyle} /></div>
          <div className="field"><label>Tempo di cambio (min)</label><input type="number" min={0} value={calendario.changeoverMinutes} onChange={(e) => setCalendario({ ...calendario, changeoverMinutes: Number(e.target.value) })} style={inputStyle} /></div>
          <div className="field"><label>Max partite/giorno</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={1} value={maxMatchesPerDay} disabled={maxMatchesUnlimited} onChange={(e) => setMaxMatchesPerDay(Number(e.target.value))} style={{ ...inputStyle, opacity: maxMatchesUnlimited ? 0.5 : 1, width: 80 }} />
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={maxMatchesUnlimited} onChange={(e) => setMaxMatchesUnlimited(e.target.checked)} /> Senza limite
              </label>
            </div>
          </div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Ogni slot campo = riscaldamento + durata match + tempo di cambio ({calendario.warmUpMinutes + calendario.matchDurationMinutes + calendario.changeoverMinutes} min). Il tempo di cambio è l'intervallo per l'uscita delle squadre e l'entrata delle successive. "Senza limite" gioca a oltranza.</p>
        <div className="actions"><button className="button secondary" disabled={savingCal} onClick={saveCalendario}>{savingCal ? 'Salvataggio...' : 'Salva calendario'}</button></div>
      </div>

      {finalsCount === 0 && (
        <>
          <SectionDivider />
          <div>
            <h3>Fase a Gironi</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
              Crea i gironi bilanciati per livello e le partite di girone. Attive: {participants.length} coppie{groups.length > 0 ? `, ${groups.length} gironi` : ''}.
            </p>
            <div className="actions">
              {matchesCount === 0 && (
                <button className="button" disabled={generating || participants.length < 2} onClick={() => handleGenerate(false)}>{generating ? 'Generazione...' : 'Genera gironi'}</button>
              )}
              {matchesCount > 0 && !confirmRegenerate && (
                <button className="button secondary" disabled={generating || participants.length < 2} onClick={() => setConfirmRegenerate(true)}>Rigenera gironi</button>
              )}
              {matchesCount > 0 && confirmRegenerate && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>Le {matchesCount} partite dei gironi e i risultati saranno eliminati. Continuare?</span>
                  <button className="button" disabled={generating} style={{ background: 'var(--danger)', padding: '6px 14px', fontSize: 13 }} onClick={() => handleGenerate(true)}>{generating ? 'Rigenerazione...' : 'Sì, rigenera'}</button>
                  <button className="button secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setConfirmRegenerate(false)}>Annulla</button>
                </span>
              )}
            </div>
            {participants.length < 2 && <p style={{ color: 'var(--warning)', fontSize: 13, marginTop: 8 }}>Servono almeno 2 coppie.</p>}
            {status === 'DRAFT' && matchesCount === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>Suggerimento: aggiungi le coppie con il livello, poi genera i gironi.</p>}
          </div>
        </>
      )}

      <SectionDivider />
      <div>
        <h3>Fase finale</h3>
        {groupMatchesTotal === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Genera prima il calendario dei gironi.</p>
        ) : groupMatchesDone < groupMatchesTotal ? (
          <p style={{ color: 'var(--warning)', fontSize: 14 }}>Completa le partite dei gironi ({groupMatchesDone}/{groupMatchesTotal} concluse) per generare la fase finale.</p>
        ) : finalsCount > 0 && !confirmRegenFinals && !confirmClose ? (
          <div className="actions" style={{ flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginRight: 8 }}>Fase finale già generata ({finalsCount} partite).</p>
            <button className="button secondary" disabled={generatingFinals} onClick={() => setConfirmRegenFinals(true)}>Rigenera fase finale</button>
            {finalsCompleted ? (
              <button className="button" disabled={closing} onClick={() => setConfirmClose(true)}>Chiudi torneo</button>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>Completa le partite della fase finale per poter chiudere il torneo.</span>
            )}
          </div>
        ) : finalsCount > 0 && confirmRegenFinals ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>Le partite della fase finale e i relativi risultati saranno eliminati. Continuare?</span>
            <button className="button" disabled={generatingFinals} style={{ background: 'var(--danger)', padding: '6px 14px', fontSize: 13 }} onClick={() => handleGenerateFinals(true)}>{generatingFinals ? 'Rigenerazione...' : 'Sì, rigenera'}</button>
            <button className="button secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setConfirmRegenFinals(false)}>Annulla</button>
          </span>
        ) : finalsCount > 0 && confirmClose ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
            <span style={{ fontSize: 13, color: '#3730a3', fontWeight: 700 }}>Chiudere il torneo? Una volta chiuso non sarà più modificabile (potrai solo eliminarlo). Continuare?</span>
            <button className="button" disabled={closing} style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleClose}>{closing ? 'Chiusura...' : 'Sì, chiudi'}</button>
            <button className="button secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setConfirmClose(false)}>Annulla</button>
          </span>
        ) : (
          <div className="actions">
            <p style={{ color: 'var(--muted)', fontSize: 14, marginRight: 8 }}>Gironi completati: puoi generare i tabelloni.</p>
            <button className="button" disabled={generatingFinals} onClick={() => handleGenerateFinals(false)}>{generatingFinals ? 'Generazione...' : 'Genera fase finale'}</button>
          </div>
        )}
      </div>
    </section>
  );
}
