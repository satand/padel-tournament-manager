'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const formats = [
  { value: 'FIXED_PAIRS', label: 'Coppie fisse' },
  { value: 'INDIVIDUAL_ROTATION', label: 'Rotazione individuale' },
  { value: 'GROUPS', label: 'Gironi' },
  { value: 'KNOCKOUT', label: 'Eliminazione diretta' },
  { value: 'GROUPS_PLUS_FINALS', label: 'Gironi + fase finale' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'LEAGUE', label: 'Campionato' },
  { value: 'AMERICANO', label: 'Americano' },
  { value: 'MEXICANO', label: 'Mexicano' },
  { value: 'KING_QUEEN_COURT', label: 'King/Queen of the Court' },
  { value: 'CUSTOM', label: 'Personalizzato' },
];

const participantTypes = [
  { value: 'TEAM', label: 'Coppie' },
  { value: 'PLAYER', label: 'Giocatori singoli' },
];

type WizardData = {
  name: string;
  startsAt: string;
  courtsCount: number;
  participantType: string;
  format: string;
  finalPhase: string;
  participants: string;
  pointsWin: number;
  pointsLoss: number;
  setsPerMatch: number;
  gamesPerSet: number;
  matchDurationMinutes: number;
  minRestMinutes: number;
  maxMatchesPerPlayerDay: number;
  timeSlots: string;
};

const initialData: WizardData = {
  name: '',
  startsAt: '',
  courtsCount: 2,
  participantType: 'TEAM',
  format: 'ROUND_ROBIN',
  finalPhase: 'none',
  participants: '',
  pointsWin: 3,
  pointsLoss: 0,
  setsPerMatch: 1,
  gamesPerSet: 6,
  matchDurationMinutes: 30,
  minRestMinutes: 15,
  maxMatchesPerPlayerDay: 6,
  timeSlots: '09:00-13:00; 15:00-19:00',
};

export function TournamentWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate() {
    if (!data.name.trim()) {
      setError('Il nome del torneo è obbligatorio.');
      setStep(1);
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
          description: `Formato: ${data.format}`,
          format: data.format,
          participantType: data.participantType,
          courtsCount: data.courtsCount,
          setsPerMatch: data.setsPerMatch,
          gamesPerSet: data.gamesPerSet,
          pointsWin: data.pointsWin,
          pointsLoss: data.pointsLoss,
          matchDurationMinutes: data.matchDurationMinutes,
          minRestMinutes: data.minRestMinutes,
          maxMatchesPerPlayerDay: data.maxMatchesPerPlayerDay,
          timeSlots: data.timeSlots || undefined,
          finalPhase: data.finalPhase !== 'none' ? data.finalPhase : undefined,
          startsAt: data.startsAt || undefined,
          participants: data.participants
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Errore dal server (${res.status})`);
      }

      const { tournament } = await res.json();
      setCreated({ id: tournament.id, slug: tournament.slug });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del torneo.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (step === 6) {
      handleCreate();
    } else {
      setStep(step + 1);
    }
  }

  const stepLabels = ['Dati', 'Formato', 'Partecipanti', 'Regole', 'Calendario', 'Conferma'];

  return (
    <section className="panel">
      <div className="steps">
        {stepLabels.map((label, index) => (
          <div
            className="step"
            key={label}
            style={{
              borderColor: step === index + 1 ? 'var(--accent)' : undefined,
              cursor: index + 1 < step ? 'pointer' : undefined,
            }}
            onClick={() => { if (index + 1 < step) setStep(index + 1); }}
          >
            <strong>{index + 1}</strong>{label}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {created && (
        <div style={{ padding: '16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#166534' }}>Torneo creato con successo!</p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="button" onClick={() => router.push(`/tournaments/${created.slug}`)}>
              Apri dashboard torneo
            </button>
            <button className="button secondary" onClick={() => { setCreated(null); setData(initialData); setStep(1); }}>
              Crea un altro torneo
            </button>
          </div>
        </div>
      )}

      {!created && (
        <>
          {step === 1 && (
            <div className="form-grid">
              <div className="field">
                <label>Nome torneo</label>
                <input placeholder="Es. Open Padel Estate" value={data.name} onChange={(e) => update('name', e.target.value)} />
              </div>
              <div className="field">
                <label>Data inizio</label>
                <input type="datetime-local" value={data.startsAt} onChange={(e) => update('startsAt', e.target.value)} />
              </div>
              <div className="field">
                <label>Campi disponibili</label>
                <input type="number" min={1} value={data.courtsCount} onChange={(e) => update('courtsCount', Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Tipo partecipanti</label>
                <select value={data.participantType} onChange={(e) => update('participantType', e.target.value)}>
                  {participantTypes.map((pt) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <div className="field">
                <label>Formato</label>
                <select value={data.format} onChange={(e) => update('format', e.target.value)}>
                  {formats.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Fase finale</label>
                <select value={data.finalPhase} onChange={(e) => update('finalPhase', e.target.value)}>
                  <option value="none">Disattivata</option>
                  <option value="semi">Semifinali + finale</option>
                  <option value="quarter">Quarti + semifinali + finale</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-grid">
              <div className="field">
                <label>Import CSV/Excel</label>
                <input type="file" accept=".csv,.xlsx" />
              </div>
              <div className="field">
                <label>Aggiunta rapida</label>
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 6px' }}>
                  {data.participantType === 'TEAM'
                    ? 'Inserisci una coppia per riga, separando i due giocatori con / (slash).'
                    : 'Inserisci un giocatore per riga (nome e cognome).'}
                </p>
                <textarea
                  rows={5}
                  placeholder={data.participantType === 'TEAM'
                    ? 'Marco Rossi / Luca Bianchi\nDavide Ferrari / Andrea Gallo\nPaolo Neri / Enrico Conti'
                    : 'Marco Rossi\nLuca Bianchi\nDavide Ferrari'}
                  value={data.participants}
                  onChange={(e) => update('participants', e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="form-grid">
              <div className="field">
                <label>Punti vittoria</label>
                <input type="number" value={data.pointsWin} onChange={(e) => update('pointsWin', Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Punti sconfitta</label>
                <input type="number" value={data.pointsLoss} onChange={(e) => update('pointsLoss', Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Set per match</label>
                <input type="number" min={1} max={5} value={data.setsPerMatch} onChange={(e) => update('setsPerMatch', Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Game per set</label>
                <input type="number" min={1} value={data.gamesPerSet} onChange={(e) => update('gamesPerSet', Number(e.target.value))} />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="form-grid">
              <div className="field">
                <label>Durata match (minuti)</label>
                <input type="number" min={5} value={data.matchDurationMinutes} onChange={(e) => update('matchDurationMinutes', Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Recupero minimo (minuti)</label>
                <input type="number" min={0} value={data.minRestMinutes} onChange={(e) => update('minRestMinutes', Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Max partite al giorno</label>
                <input type="number" min={1} value={data.maxMatchesPerPlayerDay} onChange={(e) => update('maxMatchesPerPlayerDay', Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Fasce orarie</label>
                <textarea rows={3} placeholder="09:00-13:00; 15:00-19:00" value={data.timeSlots} onChange={(e) => update('timeSlots', e.target.value)} />
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h3>Riepilogo torneo</h3>
              <div className="form-grid">
                <div className="stat"><div className="stat-label">Nome</div><div className="stat-value" style={{ fontSize: 18 }}>{data.name || '—'}</div></div>
                <div className="stat"><div className="stat-label">Data inizio</div><div className="stat-value" style={{ fontSize: 18 }}>{data.startsAt ? new Date(data.startsAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div></div>
                <div className="stat"><div className="stat-label">Formato</div><div className="stat-value" style={{ fontSize: 18 }}>{formats.find((f) => f.value === data.format)?.label}</div></div>
                <div className="stat"><div className="stat-label">Fase finale</div><div className="stat-value" style={{ fontSize: 18 }}>{data.finalPhase === 'semi' ? 'Semifinali + finale' : data.finalPhase === 'quarter' ? 'Quarti + semi + finale' : 'Disattivata'}</div></div>
                <div className="stat"><div className="stat-label">Tipo partecipanti</div><div className="stat-value" style={{ fontSize: 18 }}>{participantTypes.find((p) => p.value === data.participantType)?.label}</div></div>
                <div className="stat"><div className="stat-label">N. partecipanti</div><div className="stat-value" style={{ fontSize: 18 }}>{data.participants.split('\n').filter((l) => l.trim()).length || 0}</div></div>
                <div className="stat"><div className="stat-label">Campi</div><div className="stat-value" style={{ fontSize: 18 }}>{data.courtsCount}</div></div>
                <div className="stat"><div className="stat-label">Set per match</div><div className="stat-value" style={{ fontSize: 18 }}>{data.setsPerMatch}</div></div>
                <div className="stat"><div className="stat-label">Game per set</div><div className="stat-value" style={{ fontSize: 18 }}>{data.gamesPerSet}</div></div>
                <div className="stat"><div className="stat-label">Punti vittoria</div><div className="stat-value" style={{ fontSize: 18 }}>{data.pointsWin}</div></div>
                <div className="stat"><div className="stat-label">Punti sconfitta</div><div className="stat-value" style={{ fontSize: 18 }}>{data.pointsLoss}</div></div>
                <div className="stat"><div className="stat-label">Durata match</div><div className="stat-value" style={{ fontSize: 18 }}>{data.matchDurationMinutes} min</div></div>
                <div className="stat"><div className="stat-label">Recupero minimo</div><div className="stat-value" style={{ fontSize: 18 }}>{data.minRestMinutes} min</div></div>
                <div className="stat"><div className="stat-label">Max partite/giorno</div><div className="stat-value" style={{ fontSize: 18 }}>{data.maxMatchesPerPlayerDay}</div></div>
                {data.timeSlots && <div className="stat"><div className="stat-label">Fasce orarie</div><div className="stat-value" style={{ fontSize: 14 }}>{data.timeSlots}</div></div>}
              </div>
              {data.participants.trim() && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Lista partecipanti:</p>
                  <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text)', fontSize: 14 }}>
                    {data.participants.split('\n').filter((l) => l.trim()).map((l, i) => <li key={i}>{l.trim()}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="actions">
            <button className="button secondary" disabled={step === 1} onClick={() => setStep(Math.max(1, step - 1))}>
              Indietro
            </button>
            <button className="button" disabled={submitting} onClick={handleNext}>
              {submitting ? 'Creazione in corso...' : step === 6 ? 'Crea torneo' : 'Avanti'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
