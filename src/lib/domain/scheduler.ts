import type { Match, MatchStatus, Participant } from './types';

export type Court = { id: string; name: string; order: number };
export type ScheduleInput = {
  participants: Participant[];
  courts: Court[];
  startsAt: string;
  warmUpMinutes: number;
  matchDurationMinutes: number;
  changeoverMinutes: number;
  maxMatchesPerPlayerDay: number | null;
};

export function generateRoundRobinMatches(participants: Participant[], groupId?: string): Match[] {
  const active = participants.filter((participant) => !participant.isWithdrawn);
  const withBye = active.length % 2 === 0 ? active : [...active, { id: 'BYE', displayName: 'BYE', type: active[0]?.type ?? 'TEAM', playerIds: [] } as Participant];
  const rounds = withBye.length - 1;
  const half = withBye.length / 2;
  const rotating = [...withBye];
  const matches: Match[] = [];

  for (let round = 1; round <= rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = rotating[i];
      const b = rotating[rotating.length - 1 - i];
      if (a.id !== 'BYE' && b.id !== 'BYE') {
        matches.push({
          id: `rr-${groupId ?? 'all'}-${round}-${i + 1}`,
          participantAId: round % 2 === 0 ? b.id : a.id,
          participantBId: round % 2 === 0 ? a.id : b.id,
          status: 'SCHEDULED',
          sets: [],
          groupId,
          roundIndex: round,
          phase: groupId ? 'group' : 'round-robin',
          phaseWeight: 1
        });
      }
    }
    const fixed = rotating[0];
    const tail = rotating.slice(1);
    tail.unshift(tail.pop()!);
    rotating.splice(0, rotating.length, fixed, ...tail);
  }

  return matches;
}

export function generateKnockoutBracket(participants: Participant[], includeThirdPlace = true): Match[] {
  const seeded = [...participants].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER));
  const bracketSize = nextPowerOfTwo(seeded.length);
  const byes = bracketSize - seeded.length;
  const slots = [...seeded, ...Array.from({ length: byes }, (_, i) => ({ id: `BYE-${i + 1}`, displayName: 'BYE', type: seeded[0]?.type ?? 'TEAM', playerIds: [] } as Participant))];
  const firstRoundPairs = seedBracket(slots);
  const matches: Match[] = firstRoundPairs.map(([a, b], index) => ({
    id: `ko-r1-${index + 1}`,
    participantAId: a.id,
    participantBId: b.id,
    status: a.id.startsWith('BYE') || b.id.startsWith('BYE') ? 'WALKOVER' : 'SCHEDULED',
    winnerId: a.id.startsWith('BYE') ? b.id : b.id.startsWith('BYE') ? a.id : undefined,
    sets: [],
    roundIndex: 1,
    phase: roundLabel(bracketSize, 1),
    phaseWeight: phaseWeight(roundLabel(bracketSize, 1))
  }));

  let roundSize = bracketSize / 2;
  let round = 2;
  while (roundSize >= 1) {
    const label = roundLabel(bracketSize, round);
    for (let i = 0; i < roundSize / 2; i += 1) {
      matches.push({
        id: `ko-r${round}-${i + 1}`,
        participantAId: `WINNER:ko-r${round - 1}-${i * 2 + 1}`,
        participantBId: `WINNER:ko-r${round - 1}-${i * 2 + 2}`,
        status: 'SCHEDULED',
        sets: [],
        roundIndex: round,
        phase: label,
        phaseWeight: phaseWeight(label)
      });
    }
    roundSize /= 2;
    round += 1;
  }

  if (includeThirdPlace && bracketSize >= 4) {
    matches.push({
      id: 'ko-third-place',
      participantAId: 'LOSER:semi-1',
      participantBId: 'LOSER:semi-2',
      status: 'SCHEDULED',
      sets: [],
      roundIndex: round,
      phase: 'third-place-final',
      phaseWeight: 1.2
    });
  }

  return matches;
}

export function assignSchedule(matches: Match[], input: ScheduleInput): Match[] {
  const scheduled: Match[] = [];
  const playerLastTime = new Map<string, Date>();
  const playerMatchCount = new Map<string, number>();
  const sortedCourts = [...input.courts].sort((a, b) => a.order - b.order);
  const slot = input.warmUpMinutes + input.matchDurationMinutes + input.changeoverMinutes;
  let cursor = new Date(input.startsAt);
  let courtIndex = 0;

  for (const match of matches) {
    let attempts = 0;
    while (attempts < 10000) {
      const court = sortedCourts[courtIndex % sortedCourts.length];
      const participants = [match.participantAId, match.participantBId].filter((id): id is string => id != null);
      const hasRest = participants.every((id) => {
        const last = playerLastTime.get(id);
        if (!last) return true;
        return minutesBetween(last, cursor) >= slot;
      });
      const underDailyLimit = input.maxMatchesPerPlayerDay == null
        ? true
        : participants.every((id) => (playerMatchCount.get(id) ?? 0) < input.maxMatchesPerPlayerDay!);
      if (hasRest && underDailyLimit) {
        const assigned = { ...match, courtId: court.id, scheduledAt: cursor.toISOString() };
        scheduled.push(assigned);
        for (const id of participants) {
          playerLastTime.set(id, cursor);
          playerMatchCount.set(id, (playerMatchCount.get(id) ?? 0) + 1);
        }
        courtIndex += 1;
        if (courtIndex % sortedCourts.length === 0) cursor = addMinutes(cursor, slot);
        break;
      }
      courtIndex += 1;
      if (courtIndex % sortedCourts.length === 0) cursor = addMinutes(cursor, slot);
      attempts += 1;
    }
  }
  return scheduled;
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}

function seedBracket(slots: Participant[]): [Participant, Participant][] {
  const pairs: [Participant, Participant][] = [];
  for (let i = 0; i < slots.length / 2; i += 1) {
    pairs.push([slots[i], slots[slots.length - 1 - i]]);
  }
  return pairs;
}

function roundLabel(bracketSize: number, round: number): string {
  const remaining = bracketSize / 2 ** round;
  if (remaining === 1) return 'final';
  if (remaining === 2) return 'semifinal';
  if (remaining === 4) return 'quarterfinal';
  return `round-${round}`;
}

function phaseWeight(phase: string): number {
  if (phase === 'final') return 1.5;
  if (phase === 'semifinal') return 1.3;
  if (phase === 'quarterfinal') return 1.15;
  return 1;
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export type FinalSlot =
  | { kind: 'participant'; participantId: string }
  | { kind: 'bye' }
  | { kind: 'winner'; matchKey: string }
  | { kind: 'loser'; matchKey: string };

export type FinalBracketMatch = {
  key: string;
  roundIndex: number;
  phase: string;
  phaseWeight: number;
  bracket: 'GOLD' | 'SILVER' | null;
  a: FinalSlot;
  b: FinalSlot;
  status: MatchStatus;
  winnerId: string | null;
};

// Costruisce un tabellone a eliminazione con riferimenti genitore (per la propagazione
// dei vincenti) invece dei segnaposto testuali. Gli slot liberi restano "da definire".
export function buildFinalBracket(entrants: Participant[], bracket: 'GOLD' | 'SILVER' | null = null, sizeArg?: number): FinalBracketMatch[] {
  const players = entrants.filter((e) => e && e.id);
  const auto = nextPowerOfTwo(Math.max(2, players.length));
  const size = sizeArg && sizeArg >= players.length ? nextPowerOfTwo(sizeArg) : auto;
  const byes = size - players.length;
  const slots: (Participant | null)[] = [...players, ...Array.from({ length: byes }, () => null)];
  const pairs: [Participant | null, Participant | null][] = [];
  for (let i = 0; i < size / 2; i += 1) pairs.push([slots[i], slots[size - 1 - i]]);

  const matches: FinalBracketMatch[] = [];
  const roundKeys: string[][] = [];

  const r1keys: string[] = [];
  pairs.forEach(([a, b], i) => {
    const key = `b${bracket ?? 'x'}-r1-${i + 1}`;
    r1keys.push(key);
    const aBye = a == null;
    const bBye = b == null;
    let status: MatchStatus = 'SCHEDULED';
    let winnerId: string | null = null;
    if (aBye && bBye) status = 'CANCELLED';
    else if (aBye) { status = 'WALKOVER'; winnerId = (b as Participant).id; }
    else if (bBye) { status = 'WALKOVER'; winnerId = (a as Participant).id; }
    const label = roundLabel(size, 1);
    matches.push({
      key,
      roundIndex: 1,
      phase: label,
      phaseWeight: phaseWeight(label),
      bracket,
      a: aBye ? { kind: 'bye' } : { kind: 'participant', participantId: (a as Participant).id },
      b: bBye ? { kind: 'bye' } : { kind: 'participant', participantId: (b as Participant).id },
      status,
      winnerId
    });
  });
  roundKeys.push(r1keys);

  let round = 2;
  while (roundKeys[roundKeys.length - 1].length > 1) {
    const prev = roundKeys[roundKeys.length - 1];
    const keys: string[] = [];
    const label = roundLabel(size, round);
    for (let i = 0; i < prev.length / 2; i += 1) {
      const key = `b${bracket ?? 'x'}-r${round}-${i + 1}`;
      keys.push(key);
      matches.push({
        key,
        roundIndex: round,
        phase: label,
        phaseWeight: phaseWeight(label),
        bracket,
        a: { kind: 'winner', matchKey: prev[i * 2] },
        b: { kind: 'winner', matchKey: prev[i * 2 + 1] },
        status: 'SCHEDULED',
        winnerId: null
      });
    }
    roundKeys.push(keys);
    round += 1;
  }

  return matches;
}
