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

export function composeTeamDisplayName(teamName: string | undefined | null, playerNames: string[]): string {
  const trimmed = (teamName ?? '').trim();
  if (trimmed) return trimmed;
  return playerNames.map((n) => n.trim()).filter(Boolean).join(' / ');
}
