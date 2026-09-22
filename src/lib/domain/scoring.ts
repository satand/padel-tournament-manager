import type { ScoringConfig, ScoringMode, TournamentRules } from './types';

// Fasi considerate "fase a gironi" (usa le regole di punteggio principali).
export function isGroupPhase(phase?: string | null): boolean {
  return !phase || phase === 'group' || phase === 'round-robin';
}

// Regole di punteggio effettive per una partita: girone = regole top-level,
// fase finale = override `finalScoring` se presente (altrimenti eredita il girone).
export function rulesForPhase(rules: TournamentRules, phase?: string | null): TournamentRules {
  if (isGroupPhase(phase) || !rules.finalScoring) return rules;
  return { ...rules, ...rules.finalScoring };
}

// Regole di punteggio della sola fase finale (per l'editor/validazione del tabellone).
export function finalScoringOf(rules: TournamentRules): ScoringConfig {
  return rules.finalScoring ?? { scoringMode: rules.scoringMode, setsPerMatch: rules.setsPerMatch, gamesPerSet: rules.gamesPerSet };
}

export const GROUP_SCORING_MODES: readonly ScoringMode[] = ['GAMES_TARGET', 'TIME'];
export const ALL_SCORING_MODES: readonly ScoringMode[] = ['SETS', 'GAMES_TARGET', 'TIME'];

export const SCORING_MODE_LABEL: Record<ScoringMode, string> = {
  SETS: 'Set (al meglio di N)',
  GAMES_TARGET: 'A target (primo a N game)',
  TIME: 'A tempo'
};
