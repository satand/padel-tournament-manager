// Logica pura per il "Calendario": raggruppamento/ordinamento partite e modello PDF.
// Nessuna dipendenza da Prisma/Next; formatdata con Intl (it-IT).

import type { Match, Participant } from './types';
import { bracketLabel } from './labels';

const isFinal = (m: Match) => !!m.phase && m.phase !== 'group' && m.phase !== 'round-robin';
const tkey = (m: Match) => (m.scheduledAt ? Date.parse(m.scheduledAt) : Number.POSITIVE_INFINITY);
const byTime = (a: Match, b: Match) => (tkey(a) - tkey(b)) || ((a.roundIndex ?? 0) - (b.roundIndex ?? 0)) || a.id.localeCompare(b.id);
const numCmp = (a: string, b: string) => a.localeCompare(b, 'it', { numeric: true });

export type CalendarGroup = { key: string; label: string; matches: Match[] };

// Sezioni ordinate: gironi (A,B,…) -> tabelloni GOLD/SILVER/unico -> eventuale "Calendario".
// Dentro ogni sezione: data/ora crescente (senza data in coda), poi round, poi id.
export function calendarGroups(matches: Match[], opts?: { groupNames?: Map<string, string> }): CalendarGroup[] {
  const groupNames = opts?.groupNames;

  const groupIds: string[] = [];
  const byGroup = new Map<string, Match[]>();
  const byBracket = new Map<'GOLD' | 'SILVER' | null, Match[]>();
  const other: Match[] = [];

  for (const m of matches) {
    if (isFinal(m)) {
      const b = m.bracket ?? null;
      byBracket.set(b, [...(byBracket.get(b) ?? []), m]);
    } else if (m.groupId) {
      if (!byGroup.has(m.groupId)) { byGroup.set(m.groupId, []); groupIds.push(m.groupId); }
      byGroup.get(m.groupId)!.push(m);
    } else {
      other.push(m);
    }
  }

  const groups: CalendarGroup[] = [];
  for (const gid of [...groupIds].sort((a, b) => numCmp(groupNames?.get(a) ?? '', groupNames?.get(b) ?? ''))) {
    groups.push({ key: `g-${gid}`, label: groupNames?.get(gid) ?? 'Girone', matches: (byGroup.get(gid) ?? []).slice().sort(byTime) });
  }
  for (const b of ['GOLD', 'SILVER', null] as const) {
    const ms = byBracket.get(b);
    if (ms && ms.length > 0) groups.push({ key: `b-${b ?? 'x'}`, label: b ? `Tabellone ${bracketLabel(b)}` : 'Tabellone', matches: ms.slice().sort(byTime) });
  }
  if (other.length > 0) groups.push({ key: 'other', label: 'Calendario', matches: other.slice().sort(byTime) });

  return groups;
}

export function matchDay(m: Match): string {
  return m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}
export function matchTime(m: Match): string {
  return m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
}
export function matchResult(m: Match): string {
  return m.sets.map((s) => `${s.gamesA}-${s.gamesB}`).join(' ') || '-';
}

export type CalendarPdfRow = { teamA: string; teamB: string; court: string; day: string; time: string; result: string };
export type CalendarPdfSection = { key: string; label: string; rows: CalendarPdfRow[] };
export type CalendarPdfModel = { title: string; dateLabel: string | null; showDay: boolean; sections: CalendarPdfSection[] };

export function buildCalendarPdfModel(opts: {
  title: string;
  startsAt?: string | null;
  matches: Match[];
  participantNames?: Map<string, string>;
  groupNames?: Map<string, string>;
  courtNames?: Map<string, string>;
}): CalendarPdfModel {
  const { title, startsAt, matches } = opts;
  const name = (id: string | null) => (id ? opts.participantNames?.get(id) ?? id : '-');
  const court = (id: string | undefined) => (id ? opts.courtNames?.get(id) ?? id : '-');

  const days = matches.filter((m) => m.scheduledAt).map(matchDay).filter(Boolean);
  const distinct = new Set(days);
  const showDay = distinct.size > 1;

  let dateLabel: string | null = null;
  if (startsAt) dateLabel = new Date(startsAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  else if (distinct.size === 1) dateLabel = days[0];

  const sections: CalendarPdfSection[] = calendarGroups(matches, { groupNames: opts.groupNames }).map((g) => ({
    key: g.key,
    label: g.label,
    rows: g.matches.map((m) => ({ teamA: name(m.participantAId), teamB: name(m.participantBId), court: court(m.courtId), day: matchDay(m), time: matchTime(m), result: matchResult(m) }))
  }));

  return { title, dateLabel, showDay, sections };
}

// Elenco partecipanti per la sezione "Partecipanti": blocchi per girone (A,B,…) e, dentro,
// squadre ordinate per livello decrescente (poi nome). Il livello serve solo per ordinare
// e non viene mai esposto (output = solo id + nome squadra).
export type ParticipantBlock = { name: string; teams: { id: string; name: string }[] };

const levelDesc = (a: Participant, b: Participant) =>
  ((b.level ?? Number.NEGATIVE_INFINITY) - (a.level ?? Number.NEGATIVE_INFINITY)) || a.displayName.localeCompare(b.displayName);

export function participantsByGroupOrder(participants: Participant[], groups: { id: string; name: string }[]): ParticipantBlock[] {
  const teams = (list: Participant[]) => [...list].sort(levelDesc).map((p) => ({ id: p.id, name: p.displayName }));
  if (groups.length === 0) return [{ name: '', teams: teams(participants) }];
  const blocks: ParticipantBlock[] = [...groups]
    .sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }))
    .map((g) => ({ name: g.name, teams: teams(participants.filter((p) => p.groupId === g.id)) }));
  const unassigned = participants.filter((p) => !p.groupId || !groups.some((g) => g.id === p.groupId));
  if (unassigned.length > 0) blocks.push({ name: 'Senza girone', teams: teams(unassigned) });
  return blocks;
}
