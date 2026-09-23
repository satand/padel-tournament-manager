import type { Player } from './types';

export function parsePlayerName(full: string): { firstName: string; lastName: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

export function formatPlayerName(player: Pick<Player, 'firstName' | 'lastName'>): string {
  return `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
}

// Cognome del giocatore: usa il cognome, in fallback il nome (se inserito un solo token).
export function playerSurname(player: Pick<Player, 'firstName' | 'lastName'>): string {
  return ((player.lastName ?? '').trim() || (player.firstName ?? '').trim());
}

// Nome squadra: i soli cognomi dei due giocatori, es. "Rossi / Bianchi".
export function composeTeamDisplayName(surnames: Array<string | null | undefined>): string {
  return surnames.map((s) => (s ?? '').trim()).filter(Boolean).join(' / ');
}
