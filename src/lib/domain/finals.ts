// Logica pura per la fase finale: dimensionamento tabelloni, assegnazione Gold/Silver
// in base al ranking globale dei qualificati (punti -> diff game -> somma MVP).

import { phaseLabel, bracketLabel } from './labels';
import type { Match, Participant } from './types';

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

// ---- Classifica a piazzamento (fase raggiunta) per tabellone ----

export type BracketPlacement = {
  position: number;
  participantId: string;
  displayName: string;
  phaseLabel: string;
  wins: number;
  losses: number;
};

export type BracketPlacementTable = {
  bracket: 'GOLD' | 'SILVER' | null;
  placements: BracketPlacement[];
};

const PLACEMENT_DONE: string[] = ['COMPLETED', 'WALKOVER', 'RETIRED'];
const PLACEMENT_BRACKETS: ('GOLD' | 'SILVER' | null)[] = ['GOLD', 'SILVER', null];

function placementLabel(phase: string | undefined, champion: boolean): string {
  if (champion) return 'Campione';
  const p = (phase ?? 'group').toLowerCase();
  if (p === 'final') return 'Finalista';
  if (p === 'semifinal') return 'Semifinalista';
  if (p === 'quarterfinal') return 'Quarti di finale';
  if (p === 'third-place-final') return 'Finale 3° posto';
  return phaseLabel(phase);
}

// Classifica per tabellone: Campione primo, poi fase/round raggiunto (chi e' arrivato
// piu lontano precede), poi vittorie, poi nome; pari-merito a pari fase (ranking 1,2,3,3,5...).
export function bracketPlacements(participants: Participant[], matches: Match[]): BracketPlacementTable[] {
  const finals = matches.filter((m) => !!m.phase && m.phase !== 'group');
  if (finals.length === 0) return [];

  const nameById = new Map(participants.map((p) => [p.id, p.displayName]));
  const tables: BracketPlacementTable[] = [];

  for (const bracket of PLACEMENT_BRACKETS) {
    const ms = finals.filter((m) => (m.bracket ?? null) === bracket);
    if (ms.length === 0) continue;

    type Info = { id: string; name: string; maxRound: number; maxPhase?: string; wins: number; losses: number };
    const info = new Map<string, Info>();
    const ensure = (id: string): Info => {
      let entry = info.get(id);
      if (!entry) {
        entry = { id, name: nameById.get(id) ?? id, maxRound: 0, maxPhase: undefined, wins: 0, losses: 0 };
        info.set(id, entry);
      }
      return entry;
    };

    let championId: string | null = null;
    for (const m of ms) {
      const round = m.roundIndex ?? 0;
      for (const id of [m.participantAId, m.participantBId]) {
        if (!id) continue;
        const e = ensure(id);
        if (round >= e.maxRound) { e.maxRound = round; e.maxPhase = m.phase ?? undefined; }
      }
      const done = PLACEMENT_DONE.includes(m.status);
      if (done && m.participantAId && m.participantBId) {
        if (m.winnerId === m.participantAId) { ensure(m.participantAId).wins += 1; ensure(m.participantBId).losses += 1; }
        else if (m.winnerId === m.participantBId) { ensure(m.participantBId).wins += 1; ensure(m.participantAId).losses += 1; }
      }
      if (m.phase === 'final' && done && m.winnerId) championId = m.winnerId;
    }

    const rows = [...info.values()].map((e) => ({ ...e, champion: e.id === championId }));
    rows.sort((a, b) => {
      if (a.champion !== b.champion) return a.champion ? -1 : 1;
      if (b.maxRound !== a.maxRound) return b.maxRound - a.maxRound;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });

    const placements: BracketPlacement[] = [];
    let pos = 0;
    let prevRound: number | null = null;
    rows.forEach((r, idx) => {
      if (r.champion) { pos = 1; prevRound = null; }
      else if (r.maxRound !== prevRound) { pos = idx + 1; prevRound = r.maxRound; }
      placements.push({ position: pos, participantId: r.id, displayName: r.name, phaseLabel: placementLabel(r.maxPhase, r.champion), wins: r.wins, losses: r.losses });
    });

    tables.push({ bracket, placements });
  }

  return tables;
}

// Mappa participantId -> etichetta fase per un singolo tabellone (non prefissata).
export function bracketPhaseReached(table: BracketPlacementTable): Map<string, string> {
  return new Map(table.placements.map((p) => [p.participantId, p.phaseLabel]));
}

// Mappa participantId -> "fase raggiunta" per la classifica generale: chi non arriva ai
// tabelloni resta su baseLabel (es. 'Gironi'); chi entra nei tabelloni prende la fase,
// prefissata col tabellone quando c'e' lo split Gold/Silver (due vincitori separati).
export function generalPhaseReached(participants: Participant[], matches: Match[], baseLabel = 'Gironi'): Map<string, string> {
  const map = new Map<string, string>(participants.map((p) => [p.id, baseLabel]));
  const tables = bracketPlacements(participants, matches);
  for (const table of tables) {
    const br = table.bracket ? bracketLabel(table.bracket) : null;
    for (const p of table.placements) {
      let label = p.phaseLabel;
      if (br) {
        if (p.phaseLabel === 'Campione') label = br === 'Gold' ? 'Campione (Gold)' : `Vincitore (${br})`;
        else label = `${p.phaseLabel} (${br})`;
      }
      map.set(p.participantId, label);
    }
  }
  return map;
}
