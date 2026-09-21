import type { Participant } from './types';

function levelValue(participant: Participant): number {
  return participant.level ?? Number.NEGATIVE_INFINITY;
}

// Sorteggio bilanciato a serpentina sul livello: distribuisce le coppie piu forti
// in modo uniforme tra i gironi e riequilibra i livelli tra i gruppi.
export function generateBalancedGroups(participants: Participant[], groupCount: number): Participant[][] {
  const active = participants.filter((participant) => !participant.isWithdrawn);
  const groups = Math.max(1, Math.floor(groupCount) || 1);
  const buckets: Participant[][] = Array.from({ length: groups }, () => []);
  if (active.length === 0) return buckets;

  const sorted = [...active].sort((a, b) => levelValue(b) - levelValue(a));
  for (let i = 0; i < sorted.length; i += 1) {
    const row = Math.floor(i / groups);
    const offset = i % groups;
    const index = row % 2 === 1 ? groups - 1 - offset : offset;
    buckets[index].push(sorted[i]);
  }
  return buckets;
}

export function defaultGroupNames(groupCount: number): string[] {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: Math.max(1, groupCount) }, (_, i) => `Girone ${letters[i] ?? String(i + 1)}`);
}
