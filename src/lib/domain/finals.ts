// Logica pura per la fase finale: dimensionamento tabelloni, assegnazione Gold/Silver
// in base al ranking globale dei qualificati (punti -> diff game -> somma MVP).

export type FinalRound = 'R16' | 'R8' | 'QF' | 'SF' | 'FINAL';

export const FINAL_ROUND_SIZE: Record<FinalRound, number> = {
  FINAL: 2,
  SF: 4,
  QF: 8,
  R8: 16,
  R16: 32
};

// Ordine dal giro piu piccolo (2 squadre) al piu grande.
export const FINAL_ROUNDS: FinalRound[] = ['FINAL', 'SF', 'QF', 'R8', 'R16'];

export function roundToSize(round: FinalRound): number {
  return FINAL_ROUND_SIZE[round] ?? 2;
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.max(1, Math.ceil(Math.log2(Math.max(2, value))));
}

// Giri disponibili per un dato numero di iscritti: solo quelli capienti (size >= iscritti).
export function eligibleRounds(entrants: number): FinalRound[] {
  const fit = FINAL_ROUNDS.filter((r) => FINAL_ROUND_SIZE[r] >= entrants);
  return fit.length > 0 ? fit : ['R16'];
}

// Dimensione del tabellone: power-of-two che contiene gli iscritti; se indicato un giro
// compatibile lo rispetta (puo essere piu capiente -> BYE), altrimenti arrotonda per eccesso.
export function bracketSizeFor(entrants: number, round?: FinalRound | null): number {
  const minimum = nextPowerOfTwo(Math.max(2, entrants));
  if (!round) return minimum;
  return Math.max(roundToSize(round), minimum);
}

export type ComparableQualified = {
  id: string;
  displayName: string;
  points: number;
  gameDiff: number;
  mvpSum: number;
};

// Ordinamento globale cross-girone: punti, poi differenza game, poi somma MVP, poi nome.
export function orderQualifiers<T extends ComparableQualified>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.mvpSum !== a.mvpSum) return b.mvpSum - a.mvpSum;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function clampGoldCount(entrants: number, goldCount: number | null | undefined): number {
  if (entrants < 4) return entrants; // senza Gold/Silver reale: tutto in Gold
  const lower = 2;
  const upper = entrants - 2; // garantisce almeno 2 squadre in Silver
  const value = goldCount == null ? defaultGoldCount(entrants) : goldCount;
  return Math.min(upper, Math.max(lower, Math.trunc(value)));
}

export function defaultGoldCount(entrants: number): number {
  if (entrants < 4) return entrants;
  return Math.min(entrants - 2, Math.max(2, Math.floor(entrants / 2)));
}

export type GoldSilverSplit<T> = { gold: T[]; silver: T[] };

// Divide le qualificate gia ordinate: le prime `goldCount` in Gold, il resto in Silver.
export function splitGoldSilver<T extends ComparableQualified>(ordered: T[], goldCount: number | null | undefined): GoldSilverSplit<T> {
  if (ordered.length < 4) return { gold: ordered, silver: [] };
  const g = clampGoldCount(ordered.length, goldCount);
  return { gold: ordered.slice(0, g), silver: ordered.slice(g) };
}
