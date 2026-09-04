import { z } from 'zod';
import type { Match, MatchSetScore, TournamentRules } from './types';

export const resultSetSchema = z.object({
  setNumber: z.number().int().positive(),
  gamesA: z.number().int().min(0),
  gamesB: z.number().int().min(0),
  tieBreakA: z.number().int().min(0).optional(),
  tieBreakB: z.number().int().min(0).optional(),
  isSuperTieBreak: z.boolean().optional()
});

export const resultPayloadSchema = z.object({
  status: z.enum(['COMPLETED', 'WALKOVER', 'RETIRED', 'CANCELLED', 'POSTPONED']),
  sets: z.array(resultSetSchema),
  winnerId: z.string().optional(),
  note: z.string().max(1000).optional(),
  mvpPlayerId: z.string().optional(),
  mvpRating: z.number().min(1).max(10).optional(),
  mvpPenalty: z.number().min(0).max(10).optional()
});

export type ValidationIssue = {
  field: string;
  message: string;
};

export function validateMatchResult(match: Match, rules: TournamentRules): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (match.participantAId === match.participantBId) {
    issues.push({ field: 'participants', message: 'I due partecipanti della partita devono essere diversi.' });
  }

  if (match.status === 'COMPLETED') {
    if (match.sets.length === 0) issues.push({ field: 'sets', message: 'Inserire almeno un set per una partita conclusa.' });
    if (match.sets.length > rules.setsPerMatch) {
      issues.push({ field: 'sets', message: `Numero set superiore al massimo previsto: ${rules.setsPerMatch}.` });
    }

    for (const set of match.sets) {
      issues.push(...validateSetScore(set, rules));
    }

    const setsA = match.sets.filter((set) => set.gamesA > set.gamesB).length;
    const setsB = match.sets.filter((set) => set.gamesB > set.gamesA).length;
    const winsNeeded = Math.floor(rules.setsPerMatch / 2) + 1;
    const hasWinner = setsA >= winsNeeded || setsB >= winsNeeded || rules.setsPerMatch === 1;
    if (!rules.allowDraws && !hasWinner && setsA === setsB) {
      issues.push({ field: 'sets', message: 'La partita non può terminare in pareggio con le regole attuali.' });
    }
  }

  if (['WALKOVER', 'RETIRED'].includes(match.status) && !match.winnerId) {
    issues.push({ field: 'winnerId', message: 'Walkover o ritiro richiedono un vincitore.' });
  }

  return issues;
}

export function validateSchedulingConflicts(matches: Match[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const courtAtTime = new Map<string, string>();
  const participantAtTime = new Map<string, string>();

  for (const match of matches) {
    if (!match.scheduledAt) continue;
    const timeKey = new Date(match.scheduledAt).toISOString();
    if (match.courtId) {
      const key = `${match.courtId}:${timeKey}`;
      const existing = courtAtTime.get(key);
      if (existing) issues.push({ field: 'courtId', message: `Campo già occupato alla stessa ora: ${match.courtId}. Partite: ${existing}, ${match.id}.` });
      courtAtTime.set(key, match.id);
    }

    for (const participantId of [match.participantAId, match.participantBId]) {
      const key = `${participantId}:${timeKey}`;
      const existing = participantAtTime.get(key);
      if (existing) issues.push({ field: 'scheduledAt', message: `Partecipante ${participantId} assegnato a due partite nello stesso orario.` });
      participantAtTime.set(key, match.id);
    }
  }

  return issues;
}

function validateSetScore(set: MatchSetScore, rules: TournamentRules): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (set.gamesA === set.gamesB) {
    issues.push({ field: `sets.${set.setNumber}`, message: 'Un set non può terminare con game pari.' });
  }

  if (set.isSuperTieBreak) {
    const max = Math.max(set.gamesA, set.gamesB);
    const min = Math.min(set.gamesA, set.gamesB);
    if (!rules.superTieBreakEnabled) issues.push({ field: `sets.${set.setNumber}`, message: 'Super tie-break non abilitato.' });
    if (max < 10 || max - min < 2) issues.push({ field: `sets.${set.setNumber}`, message: 'Super tie-break non valido: servono almeno 10 punti e 2 di scarto.' });
    return issues;
  }

  const target = rules.gamesPerSet;
  const max = Math.max(set.gamesA, set.gamesB);
  const min = Math.min(set.gamesA, set.gamesB);
  const normalWin = max === target && min <= target - 2;
  const extendedWin = max === target + 1 && min === target - 1;
  const tieBreakWin = rules.tieBreakEnabled && max === target + 1 && min === target;

  if (!normalWin && !extendedWin && !tieBreakWin) {
    issues.push({ field: `sets.${set.setNumber}`, message: `Punteggio set non compatibile con set a ${target} game.` });
  }

  if ((set.tieBreakA !== undefined || set.tieBreakB !== undefined) && !rules.tieBreakEnabled) {
    issues.push({ field: `sets.${set.setNumber}.tieBreak`, message: 'Tie-break inserito ma non abilitato.' });
  }

  return issues;
}
