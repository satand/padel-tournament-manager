// Formattazione orari/data nel fuso del torneo (IANA), DST gestita da Intl. Nessuna dipendenza.
// I momenti restano istanti UTC (ISO); qui cambia SOLO il fuso di visualizzazione.

export const DEFAULT_TIMEZONE = 'Europe/Rome';

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('it-IT', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function safeTz(tz?: string | null): string {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

const fmt = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('it-IT', { ...opts, timeZone: safeTz(tz) }).format(new Date(iso));

// 'dd/mm/yyyy'
export function formatDay(iso: string | null | undefined, tz?: string | null): string {
  return iso ? fmt(iso, safeTz(tz), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}
// 'HH:mm'
export function formatTime(iso: string | null | undefined, tz?: string | null): string {
  return iso ? fmt(iso, safeTz(tz), { hour: '2-digit', minute: '2-digit' }) : '';
}
// 'gio 21 settembre 2026, 09:30'
export function formatDateTime(iso: string | null | undefined, tz?: string | null): string {
  return iso ? fmt(iso, safeTz(tz), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
// 'gio 21 settembre 2026' (etichetta lunga di sola data)
export function formatLongDate(iso: string | null | undefined, tz?: string | null): string {
  return iso ? fmt(iso, safeTz(tz), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
}
// chiave di raggruppamento per giorno nel fuso (per distinguere piu' giorni)
export function dayKey(iso: string | null | undefined, tz?: string | null): string {
  return iso ? fmt(iso, safeTz(tz), { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
}

// Lista curata di fusi per la UI (default: Roma).
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Rome', label: 'Roma (UTC+1/+2)' },
  { value: 'Europe/London', label: 'Londra (UTC+0/+1)' },
  { value: 'Europe/Lisbon', label: 'Lisbona (UTC+0/+1)' },
  { value: 'Europe/Madrid', label: 'Madrid/Parigi (UTC+1/+2)' },
  { value: 'Europe/Berlin', label: 'Berlino (UTC+1/+2)' },
  { value: 'Europe/Athens', label: 'Atene (UTC+2/+3)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (UTC+3)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
  { value: 'UTC', label: 'UTC (senza ora legale)' }
];
