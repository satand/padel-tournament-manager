import type { MatchStatus } from '@/lib/domain/types';

export function phaseLabel(phase?: string): string {
  if (!phase) return 'Fase';
  switch (phase) {
    case 'final':
      return 'Finale';
    case 'semifinal':
      return 'Semifinale';
    case 'quarterfinal':
      return 'Quarti di finale';
    case 'third-place-final':
      return 'Finale 3° posto';
    case 'round-robin':
      return 'Round Robin';
    case 'group':
      return 'Girone';
    default: {
      const m = /^round-(\d+)$/.exec(phase);
      if (m) return `Turno ${m[1]}`;
      return phase;
    }
  }
}

export function bracketLabel(bracket?: string | null): string {
  if (bracket === 'GOLD') return 'Gold';
  if (bracket === 'SILVER') return 'Silver';
  return '';
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: 'In programma',
  IN_PROGRESS: 'In corso',
  COMPLETED: 'Conclusa',
  CANCELLED: 'Annullata',
  POSTPONED: 'Posticipata',
  WALKOVER: 'A tavolino',
  RETIRED: 'Ritiro'
};

export function matchStatusLabel(status: MatchStatus): string {
  return STATUS_LABEL[status] ?? status;
}
