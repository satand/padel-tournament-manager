'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type WizardData = {
  name: string;
  startsAt: string;
  courtsCount: number;
  groupCount: number;
  qualifiedPerGroup: number;
  finalStartRound: string;
  splitGoldSilver: boolean;
  scoringMode: string;
  maxSets: number;
  gamesPerSet: number;
  targetGames: number;
  pointsWin: number;
  pointsLoss: number;
  mvpEnabled: boolean;
  mvpThroughPhase: string;
  matchDurationMinutes: number;
  minRestMinutes: number;
  maxMatchesPerPlayerDay: number;
  timeSlots: string;
};

const initialData: WizardData = {
  name: '',
  startsAt: '',
  courtsCount: 2,
  groupCount: 2,
  qualifiedPerGroup: 2,
  finalStartRound: 'SF',
  splitGoldSilver: true,
  scoringMode: 'SETS',
  maxSets: 1,
  gamesPerSet: 6,
  targetGames: 21,
  pointsWin: 3,
  pointsLoss: 0,
  mvpEnabled: true,
  mvpThroughPhase: 'FINAL',
  matchDurationMinutes: 30,
  minRestMinutes: 15,
  maxMatchesPerPlayerDay: 6,
  timeSlots: '09:00-13:00; 15:00-19:00'
};

export function TournamentWizard() {
  const router = useRouter();
  const [data, setData] = useState<WizardData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate() {
    if (!data.name.trim()) {
      setError('Il nome del torneo è obbligatorio.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          format: 'GROUPS_PLUS_FINALS',
          startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : undefined,
          courtsCount: data.courtsCount,
          groupCount: data.groupCount,
          qualifiedPerGroup: data.qualifiedPerGroup,
          finalStartRound: data.finalStartRound,
          splitGoldSilver: data.splitGoldSilver,
          pointsWin: data.pointsWin,
          pointsLoss: data.pointsLoss,
          mvpEnabled: data.mvpEnabled,
          mvpThroughPhase: data.mvpThroughPhase,
          matchDurationMinutes: data.matchDurationMinutes,
          minRestMinutes: data.minRestMinutes,
          maxMatchesPerPlayerDay: data.maxMatchesPerPlayerDay,
          timeSlots: data.timeSlots || undefined
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Errore dal server (${res.status})`);
      }
      const { tournament } = await res.json();
      router.push(`/tournaments/${tournament.slug ?? tournament.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del torneo.');
      setSubmitting(false);
    }
  }

  const sectionStyle = { marginTop: 16 } as const;

  return (
    <section className="panel">
      <h1>Nuovo torneo</h1>
      <p className="lead">Definisci il tipo di torneo. Le coppie iscritte si aggiungono dopo, nella pagina di amministrazione.</p>

      {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: 16 }}>{error}</div>}

      <div style={sectionStyle}>
        <h3>Dati generali</h3>
        <div className="form-grid">
          <div className="field"><label>Nome torneo</label><input placeholder="Es. Open Padel Estate" value={data.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="field"><label>Data inizio</label><input type="datetime-local" value={data.startsAt} onChange={(e) => update('startsAt', e.target.value)} /></div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3>Formato: gironi + fase finale</h3>
        <div className="form-grid">
          <div className="field"><label>Numero di gironi</label><input type="number" min={1} value={data.groupCount} onChange={(e) => update('groupCount', Number(e.target.value))} /></div>
          <div className="field"><label>Qualificati per girone</label><input type="number" min={1} value={data.qualifiedPerGroup} onChange={(e) => update('qualifiedPerGroup', Number(e.target.value))} /></div>
          <div className="field"><label>Fase finale da</label>
            <select value={data.finalStartRound} onChange={(e) => update('finalStartRound', e.target.value)}>
              <option value="R16">Sedicesimi</option>
              <option value="R8">Ottavi</option>
              <option value="QF">Quarti</option>
              <option value="SF">Semifinali</option>
              <option value="FINAL">Solo finale</option>
            </select>
          </div>
          <div className="field"><label>Tabelloni</label>
            <select value={data.splitGoldSilver ? 'gold-silver' : 'single'} onChange={(e) => update('splitGoldSilver', e.target.value === 'gold-silver')}>
              <option value="gold-silver">Gold + Silver</option>
              <option value="single">Tabellone unico</option>
            </select>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3>Punti in classifica</h3>
        <div className="form-grid">
          <div className="field"><label>Punti vittoria</label><input type="number" value={data.pointsWin} onChange={(e) => update('pointsWin', Number(e.target.value))} /></div>
          <div className="field"><label>Punti sconfitta</label><input type="number" value={data.pointsLoss} onChange={(e) => update('pointsLoss', Number(e.target.value))} /></div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>La <strong>modalità di punteggio</strong> (giri e fase finale) si imposta nella pagina di <strong>amministrazione</strong> del torneo, prima di generare il calendario.</p>
      </div>

      <div style={sectionStyle}>
        <h3>MVP</h3>
        <div className="form-grid">
          <div className="field"><label>MVP attivo</label>
            <select value={data.mvpEnabled ? 'si' : 'no'} onChange={(e) => update('mvpEnabled', e.target.value === 'si')}><option value="si">Sì</option><option value="no">No</option></select>
          </div>
          <div className="field"><label>Conta MVP fino a</label>
            <select value={data.mvpThroughPhase} onChange={(e) => update('mvpThroughPhase', e.target.value)}>
              <option value="GROUP">Solo fase a gironi</option>
              <option value="R16">Fino ai sedicesimi</option>
              <option value="R8">Fino agli ottavi</option>
              <option value="QF">Fino ai quarti</option>
              <option value="SF">Fino alle semifinali</option>
              <option value="FINAL">Fino alla finale</option>
            </select>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3>Calendario (modificabile anche dopo)</h3>
        <div className="form-grid">
          <div className="field"><label>Campi disponibili</label><input type="number" min={1} value={data.courtsCount} onChange={(e) => update('courtsCount', Number(e.target.value))} /></div>
          <div className="field"><label>Durata match (min)</label><input type="number" min={5} value={data.matchDurationMinutes} onChange={(e) => update('matchDurationMinutes', Number(e.target.value))} /></div>
          <div className="field"><label>Recupero minimo (min)</label><input type="number" min={0} value={data.minRestMinutes} onChange={(e) => update('minRestMinutes', Number(e.target.value))} /></div>
          <div className="field"><label>Max partite/giorno</label><input type="number" min={1} value={data.maxMatchesPerPlayerDay} onChange={(e) => update('maxMatchesPerPlayerDay', Number(e.target.value))} /></div>
        </div>
      </div>

      <div className="actions" style={{ marginTop: 20 }}>
        <button className="button" disabled={submitting} onClick={handleCreate}>{submitting ? 'Creazione...' : 'Crea torneo e aggiungi le coppie'}</button>
      </div>
    </section>
  );
}
