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
