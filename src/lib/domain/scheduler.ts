import type { Match, Participant } from './types';

export type Court = { id: string; name: string; order: number };
export type ScheduleInput = {
  participants: Participant[];
  courts: Court[];
  startsAt: string;
  matchDurationMinutes: number;
  minRestMinutes: number;
  maxMatchesPerPlayerDay: number;
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

export function generateAmericanoRounds(players: Participant[], rounds: number): Match[] {
  if (players.length < 4) throw new Error('Il torneo americano richiede almeno 4 giocatori.');
  if (players.length % 4 !== 0) throw new Error('Per questa base applicativa il torneo americano richiede un numero di giocatori multiplo di 4.');

  const matches: Match[] = [];
  let rotation = [...players];
  for (let round = 1; round <= rounds; round += 1) {
    for (let courtIndex = 0; courtIndex < rotation.length / 4; courtIndex += 1) {
      const chunk = rotation.slice(courtIndex * 4, courtIndex * 4 + 4);
      const teamA = createVirtualTeam(chunk[0], chunk[3], round, courtIndex, 'A');
      const teamB = createVirtualTeam(chunk[1], chunk[2], round, courtIndex, 'B');
      matches.push({
        id: `americano-${round}-${courtIndex + 1}`,
        participantAId: teamA.id,
        participantBId: teamB.id,
        status: 'SCHEDULED',
        sets: [],
        roundIndex: round,
        phase: 'americano',
        phaseWeight: 1
      });
    }
    rotation = rotateKeepingFirst(rotation);
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
  let cursor = new Date(input.startsAt);
  let courtIndex = 0;

  for (const match of matches) {
    let attempts = 0;
    while (attempts < 10000) {
      const court = sortedCourts[courtIndex % sortedCourts.length];
      const participants = [match.participantAId, match.participantBId];
      const hasRest = participants.every((id) => {
        const last = playerLastTime.get(id);
        if (!last) return true;
        return minutesBetween(last, cursor) >= input.matchDurationMinutes + input.minRestMinutes;
      });
      const underDailyLimit = participants.every((id) => (playerMatchCount.get(id) ?? 0) < input.maxMatchesPerPlayerDay);
      if (hasRest && underDailyLimit) {
        const assigned = { ...match, courtId: court.id, scheduledAt: cursor.toISOString() };
        scheduled.push(assigned);
        for (const id of participants) {
          playerLastTime.set(id, cursor);
          playerMatchCount.set(id, (playerMatchCount.get(id) ?? 0) + 1);
        }
        courtIndex += 1;
        if (courtIndex % sortedCourts.length === 0) cursor = addMinutes(cursor, input.matchDurationMinutes);
        break;
      }
      courtIndex += 1;
      if (courtIndex % sortedCourts.length === 0) cursor = addMinutes(cursor, input.matchDurationMinutes);
      attempts += 1;
    }
  }
  return scheduled;
}

export function nextKingQueenRound(
  orderedCourtParticipants: Participant[],
  previousRoundResults: { courtIndex: number; winnerParticipantId: string; loserParticipantId: string }[]
): Participant[] {
  const next = [...orderedCourtParticipants];
  for (const result of previousRoundResults) {
    const winnerIndex = next.findIndex((p) => p.id === result.winnerParticipantId);
    const loserIndex = next.findIndex((p) => p.id === result.loserParticipantId);
    if (winnerIndex === -1 || loserIndex === -1) continue;
    const promotedIndex = Math.max(0, winnerIndex - 1);
    const relegatedIndex = Math.min(next.length - 1, loserIndex + 1);
    [next[winnerIndex], next[promotedIndex]] = [next[promotedIndex], next[winnerIndex]];
    [next[loserIndex], next[relegatedIndex]] = [next[relegatedIndex], next[loserIndex]];
  }
  return next;
}

function createVirtualTeam(a: Participant, b: Participant, round: number, courtIndex: number, side: string): Participant {
  return {
    id: `virtual-${round}-${courtIndex}-${side}-${a.id}-${b.id}`,
    displayName: `${a.displayName} / ${b.displayName}`,
    type: 'TEAM',
    playerIds: [...a.playerIds, ...b.playerIds]
  };
}

function rotateKeepingFirst<T>(items: T[]): T[] {
  const [first, ...rest] = items;
  rest.unshift(rest.pop()!);
  return [first, ...rest];
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
