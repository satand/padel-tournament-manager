'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type WizardData = {
  name: string;
  startsAt: string;
};

const initialData: WizardData = {
  name: '',
  startsAt: ''
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
          startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : undefined
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

  return (
    <section className="panel">
      <h1>Nuovo torneo</h1>
      <p className="lead">Inserisci i dati essenziali. Aggiungi le squadre e configura il torneo nella pagina di amministrazione.</p>

      {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: 16 }}>{error}</div>}

      <div style={{ marginTop: 16 }}>
        <h3>Dati generali</h3>
        <div className="form-grid">
          <div className="field"><label>Nome torneo</label><input placeholder="Es. Open Padel Estate" value={data.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="field"><label>Data inizio</label><input type="datetime-local" value={data.startsAt} onChange={(e) => update('startsAt', e.target.value)} /></div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
          Dopo la creazione potrai aggiungere le squadre e configurare <strong>formato</strong>, <strong>modalità di punteggio</strong> (giri e fase finale) e <strong>calendario</strong> dalla pagina di amministrazione, una volta noto il numero degli iscritti.
        </p>
      </div>

      <div className="actions" style={{ marginTop: 20 }}>
        <button className="button" disabled={submitting} onClick={handleCreate}>{submitting ? 'Creazione...' : 'Crea torneo e aggiungi le squadre'}</button>
      </div>
    </section>
  );
}
