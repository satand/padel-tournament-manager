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
};

type CoupleForm = { participantId: string | null; teamName: string; player1: string; player2: string; level: string };
const emptyCouple: CoupleForm = { participantId: null, teamName: '', player1: '', player2: '', level: '1' };

function toInputDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TournamentActions({ tournamentId, status, startsAt, participants, matchesCount, groups, settings, finalsCount, groupMatchesTotal, groupMatchesDone }: Props) {
  const router = useRouter();
  const [couple, setCouple] = useState<CoupleForm>(emptyCouple);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingFinals, setGeneratingFinals] = useState(false);
  const [confirmRegenFinals, setConfirmRegenFinals] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [calendario, setCalendario] = useState({
    courtsCount: settings?.courtsCount ?? 2,
    matchDurationMinutes: settings?.matchDurationMinutes ?? 30,
    minRestMinutes: settings?.minRestMinutes ?? 15,
    maxMatchesPerPlayerDay: settings?.maxMatchesPerPlayerDay ?? 6
  });
  const [savingCal, setSavingCal] = useState(false);
  const [startDate, setStartDate] = useState(toInputDate(startsAt));
  const [savingDate, setSavingDate] = useState(false);

  const [presentSlideSeconds, setPresentSlideSeconds] = useState<number | ''>(settings?.presentSlideSeconds ?? 6);
  const [savingProj, setSavingProj] = useState(false);

  const [savingStruct, setSavingStruct] = useState(false);
  const [struct, setStruct] = useState<{
    scoringMode: string; targetGames: number;
    finalScoringMode: string; finalMaxSets: number; finalGamesPerSet: number; finalTargetGames: number;
    groupCount: number; qualifiedPerGroup: number; finalStartRound: string;
    splitGoldSilver: boolean; mvpEnabled: boolean; mvpThroughPhase: string;
  }>({
    scoringMode: settings?.scoringMode === 'SETS' ? 'GAMES_TARGET' : (settings?.scoringMode ?? 'GAMES_TARGET'),
    targetGames: settings?.targetGames ?? 21,
    finalScoringMode: settings?.finalScoringMode ?? '',
    finalMaxSets: settings?.finalSetsPerMatch ?? 3,
    finalGamesPerSet: settings?.finalGamesPerSet ?? 6,
    finalTargetGames: settings?.finalTargetGames ?? 21,
    groupCount: settings?.groupCount ?? 2,
    qualifiedPerGroup: settings?.qualifiedPerGroup ?? 2,
    finalStartRound: settings?.finalStartRound ?? 'SF',
    splitGoldSilver: settings?.splitGoldSilver ?? true,
    mvpEnabled: settings?.mvpEnabled ?? true,
    mvpThroughPhase: settings?.mvpThroughPhase ?? 'FINAL'
  });

  function setMessageLater(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
  }

  function startEdit(p: ParticipantRow) {
    setCouple({
      participantId: p.id,
      teamName: p.displayName.includes(' / ') ? '' : p.displayName,
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
      teamName: couple.teamName.trim() || undefined,
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
        body: JSON.stringify(calendario)
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
          splitGoldSilver: struct.splitGoldSilver,
          mvpEnabled: struct.mvpEnabled,
          mvpThroughPhase: struct.mvpThroughPhase
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

      <div style={{ marginBottom: 16 }}>
        <h3>Dati torneo</h3>
        <div className="form-grid">
          <div className="field">
            <label>Data inizio</label>
            {status === 'DRAFT' ? (
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: '#f8fafc', fontSize: 14 }}>
                {startsAt ? new Date(startsAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Non impostata'}
              </div>
            )}
          </div>
        </div>
        {status === 'DRAFT' ? (
          <div className="actions"><button className="button secondary" disabled={savingDate} onClick={saveDate}>{savingDate ? 'Salvataggio...' : 'Salva data'}</button></div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>Modificabile solo quando il torneo è in bozza.</p>
        )}
      </div>

      <div className="grid grid-2">
        <div>
          <h3>{editing ? 'Modifica coppia' : 'Aggiungi coppia'}</h3>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Nome squadra (facoltativo)</label>
              <input placeholder="Se vuoto: Giocatore1 / Giocatore2" value={couple.teamName} onChange={(e) => setCouple({ ...couple, teamName: e.target.value })} />
            </div>
            <div className="field">
              <label>Giocatore 1</label>
              <input placeholder="Nome e cognome" value={couple.player1} onChange={(e) => setCouple({ ...couple, player1: e.target.value })} />
            </div>
            <div className="field">
              <label>Giocatore 2</label>
              <input placeholder="Nome e cognome" value={couple.player2} onChange={(e) => setCouple({ ...couple, player2: e.target.value })} />
            </div>
            <div className="field">
              <label>Livello (obbligatorio, 0–10, 1 decimale)</label>
              <input type="number" min={0} max={10} step={0.1} required value={couple.level} onChange={(e) => setCouple({ ...couple, level: e.target.value })} />
            </div>
          </div>
          <div className="actions">
            <button className="button" disabled={busy} onClick={saveCouple}>{busy ? 'Salvataggio...' : editing ? 'Salva modifiche' : 'Aggiungi coppia'}</button>
            {editing && <button className="button secondary" onClick={() => setCouple(emptyCouple)}>Annulla modifica</button>}
          </div>
        </div>

        <div>
          <h3>Coppie iscritte ({participants.length})</h3>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {participants.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0' }}>Nessuna coppia inserita.</p>}
            {participants.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)', fontSize: 14 }}>
                <span style={{ minWidth: 0 }}>
                  <strong>{p.displayName}</strong>
                  {p.level != null && <span style={{ color: 'var(--muted)' }}> · liv. {p.level}</span>}
                </span>
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
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Impostazioni strutturali</h3>
        {status !== 'DRAFT' ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Bloccate: il calendario è già stato generato. Crea un nuovo torneo per cambiare queste opzioni.</p>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 8px' }}>Modificabili finché il torneo è in bozza (prima di generare il calendario).</p>
            <div className="form-grid">
              <div className="field"><label>Girone · Modalità punteggio</label>
                <select value={struct.scoringMode} onChange={(e) => setStruct({ ...struct, scoringMode: e.target.value })}>
                  <option value="GAMES_TARGET">A target (primo a N game)</option>
                  <option value="TIME">A tempo</option>
                </select>
              </div>
              {struct.scoringMode === 'GAMES_TARGET' && (
                <div className="field"><label>Girone · Game da raggiungere</label><input type="number" min={1} value={struct.targetGames} onChange={(e) => setStruct({ ...struct, targetGames: Number(e.target.value) })} /></div>
              )}
              <div className="field"><label>Fase finale · Modalità punteggio</label>
                <select value={struct.finalScoringMode} onChange={(e) => setStruct({ ...struct, finalScoringMode: e.target.value })}>
                  <option value="">Uguale ai gironi</option>
                  <option value="SETS">Set (al meglio di N)</option>
                  <option value="GAMES_TARGET">A target (primo a N game)</option>
                  <option value="TIME">A tempo</option>
                </select>
              </div>
              {struct.finalScoringMode === 'SETS' && (
                <>
                  <div className="field"><label>Finale · Set al meglio di</label><input type="number" min={1} max={3} value={struct.finalMaxSets} onChange={(e) => setStruct({ ...struct, finalMaxSets: Number(e.target.value) })} /></div>
                  <div className="field"><label>Finale · Game per set</label><input type="number" min={1} value={struct.finalGamesPerSet} onChange={(e) => setStruct({ ...struct, finalGamesPerSet: Number(e.target.value) })} /></div>
                </>
              )}
              {struct.finalScoringMode === 'GAMES_TARGET' && (
                <div className="field"><label>Finale · Game da raggiungere</label><input type="number" min={1} value={struct.finalTargetGames} onChange={(e) => setStruct({ ...struct, finalTargetGames: Number(e.target.value) })} /></div>
              )}
              <div className="field"><label>Numero di gironi</label><input type="number" min={1} value={struct.groupCount} onChange={(e) => setStruct({ ...struct, groupCount: Number(e.target.value) })} /></div>
              <div className="field"><label>Qualificati per girone</label><input type="number" min={1} value={struct.qualifiedPerGroup} onChange={(e) => setStruct({ ...struct, qualifiedPerGroup: Number(e.target.value) })} /></div>
              <div className="field"><label>Fase finale da</label>
                <select value={struct.finalStartRound} onChange={(e) => setStruct({ ...struct, finalStartRound: e.target.value })}>
                  <option value="R16">Sedicesimi</option><option value="R8">Ottavi</option><option value="QF">Quarti</option><option value="SF">Semifinali</option><option value="FINAL">Solo finale</option>
                </select>
              </div>
              <div className="field"><label>Tabelloni</label>
                <select value={struct.splitGoldSilver ? 'gs' : 'single'} onChange={(e) => setStruct({ ...struct, splitGoldSilver: e.target.value === 'gs' })}>
                  <option value="gs">Gold + Silver</option><option value="single">Tabellone unico</option>
                </select>
              </div>
              <div className="field"><label>MVP attivo</label>
                <select value={struct.mvpEnabled ? 'si' : 'no'} onChange={(e) => setStruct({ ...struct, mvpEnabled: e.target.value === 'si' })}><option value="si">Sì</option><option value="no">No</option></select>
              </div>
              <div className="field"><label>Conta MVP fino a</label>
                <select value={struct.mvpThroughPhase} onChange={(e) => setStruct({ ...struct, mvpThroughPhase: e.target.value })}>
                  <option value="GROUP">Solo gironi</option><option value="R16">Sedicesimi</option><option value="R8">Ottavi</option><option value="QF">Quarti</option><option value="SF">Semifinali</option><option value="FINAL">Finale</option>
                </select>
              </div>
            </div>
            <div className="actions"><button className="button secondary" disabled={savingStruct} onClick={saveStruct}>{savingStruct ? 'Salvataggio...' : 'Salva impostazioni'}</button></div>
          </>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Calendario</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Parametri applicati alla generazione. Puoi modificarli e rigenerare in qualsiasi momento (i risultati vanno persi solo se rigeneri).</p>
        <div className="form-grid">
          <div className="field"><label>Nº campi</label><input type="number" min={1} value={calendario.courtsCount} onChange={(e) => setCalendario({ ...calendario, courtsCount: Number(e.target.value) })} style={inputStyle} /></div>
          <div className="field"><label>Durata match (min)</label><input type="number" min={5} value={calendario.matchDurationMinutes} onChange={(e) => setCalendario({ ...calendario, matchDurationMinutes: Number(e.target.value) })} style={inputStyle} /></div>
          <div className="field"><label>Recupero minimo (min)</label><input type="number" min={0} value={calendario.minRestMinutes} onChange={(e) => setCalendario({ ...calendario, minRestMinutes: Number(e.target.value) })} style={inputStyle} /></div>
          <div className="field"><label>Max partite/giorno</label><input type="number" min={1} value={calendario.maxMatchesPerPlayerDay} onChange={(e) => setCalendario({ ...calendario, maxMatchesPerPlayerDay: Number(e.target.value) })} style={inputStyle} /></div>
        </div>
        <div className="actions"><button className="button secondary" disabled={savingCal} onClick={saveCalendario}>{savingCal ? 'Salvataggio...' : 'Salva calendario'}</button></div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Schermo di proiezione</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Secondi di permanenza di ogni slide nel carosello della schermata di proiezione (2–120).</p>
        <div className="form-grid">
          <div className="field"><label>Cambio automatico slide (secondi)</label><input type="number" min={2} max={120} value={presentSlideSeconds} onChange={(e) => setPresentSlideSeconds(e.target.value === '' ? '' : Number(e.target.value))} style={inputStyle} /></div>
        </div>
        <div className="actions"><button className="button secondary" disabled={savingProj} onClick={saveProiezione}>{savingProj ? 'Salvataggio...' : 'Salva proiezione'}</button></div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Genera calendario</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
          Crea i gironi bilanciati per livello e le partite di girone. Attive: {participants.length} coppie{groups.length > 0 ? `, ${groups.length} gironi` : ''}.
        </p>
        <div className="actions">
          {matchesCount === 0 && (
            <button className="button" disabled={generating || participants.length < 2} onClick={() => handleGenerate(false)}>{generating ? 'Generazione...' : 'Genera calendario'}</button>
          )}
          {matchesCount > 0 && !confirmRegenerate && (
            <button className="button secondary" disabled={generating || participants.length < 2} onClick={() => setConfirmRegenerate(true)}>Rigenera calendario</button>
          )}
          {matchesCount > 0 && confirmRegenerate && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>Le {matchesCount} partite e i risultati saranno eliminati. Continuare?</span>
              <button className="button" disabled={generating} style={{ background: 'var(--danger)', padding: '6px 14px', fontSize: 13 }} onClick={() => handleGenerate(true)}>{generating ? 'Rigenerazione...' : 'Sì, rigenera'}</button>
              <button className="button secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setConfirmRegenerate(false)}>Annulla</button>
            </span>
          )}
        </div>
        {participants.length < 2 && <p style={{ color: 'var(--warning)', fontSize: 13, marginTop: 8 }}>Servono almeno 2 coppie.</p>}
        {status === 'DRAFT' && matchesCount === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>Suggerimento: aggiungi le coppie con il livello, poi genera i gironi.</p>}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Fase finale</h3>
        {groupMatchesTotal === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Genera prima il calendario dei gironi.</p>
        ) : groupMatchesDone < groupMatchesTotal ? (
          <p style={{ color: 'var(--warning)', fontSize: 14 }}>Completa le partite dei gironi ({groupMatchesDone}/{groupMatchesTotal} concluse) per generare la fase finale.</p>
        ) : finalsCount > 0 && !confirmRegenFinals ? (
          <div className="actions">
            <p style={{ color: 'var(--muted)', fontSize: 14, marginRight: 8 }}>Fase finale già generata ({finalsCount} partite).</p>
            <button className="button secondary" disabled={generatingFinals} onClick={() => setConfirmRegenFinals(true)}>Rigenera fase finale</button>
          </div>
        ) : finalsCount > 0 && confirmRegenFinals ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>Le partite della fase finale e i relativi risultati saranno eliminati. Continuare?</span>
            <button className="button" disabled={generatingFinals} style={{ background: 'var(--danger)', padding: '6px 14px', fontSize: 13 }} onClick={() => handleGenerateFinals(true)}>{generatingFinals ? 'Rigenerazione...' : 'Sì, rigenera'}</button>
            <button className="button secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setConfirmRegenFinals(false)}>Annulla</button>
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
