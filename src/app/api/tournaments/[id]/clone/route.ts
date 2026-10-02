import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// Rimuove id/campi di audit e (opzionali) relazioni/scalari di FK da una riga Prisma.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function base(row: any, extra: string[] = []): any {
  const clone: Record<string, unknown> = { ...row };
  delete clone.id;
  delete clone.createdAt;
  delete clone.updatedAt;
  for (const key of extra) delete clone[key];
  return clone;
}

// Clona integralmente un torneo (backup): impostazioni, coppie, campi, gironi,
// partite con set/risultati/voti MVP e collegamenti dei tabelloni, mantenendo lo stato.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const src = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      settings: true,
      players: true,
      teams: { include: { members: true } },
      participants: true,
      groups: { orderBy: { sortOrder: 'asc' } },
      courts: { orderBy: { order: 'asc' } },
      matches: { include: { sets: true, result: true, mvpVotes: true } }
    }
  });
  if (!src) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const name = `${src.name} (copia)`;
  const baseSlug = (src.slug || src.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'torneo';

  const cloned = await prisma.$transaction(async (tx) => {
    let slug = `${baseSlug}-copia`;
    for (let i = 1; await tx.tournament.findUnique({ where: { slug } }); i += 1) {
      slug = `${baseSlug}-copia-${Date.now().toString(36)}${i > 1 ? `-${i}` : ''}`;
    }

    const tournament = await tx.tournament.create({
      data: {
        name,
        slug,
        description: src.description,
        format: src.format,
        status: src.status,
        organizerId: src.organizerId,
        publicEnabled: src.publicEnabled,
        startsAt: src.startsAt,
        endsAt: src.endsAt,
        ...(src.settings ? { settings: { create: base(src.settings as unknown as Record<string, unknown>, ['tournamentId']) } } : {})
      },
      select: { id: true, slug: true, name: true }
    });

    const playerMap = new Map<string, string>();
    for (const p of src.players) {
      const created = await tx.player.create({ data: { ...base(p as unknown as Record<string, unknown>, ['tournamentId']), tournamentId: tournament.id } });
      playerMap.set(p.id, created.id);
    }

    const teamMap = new Map<string, string>();
    for (const team of src.teams) {
      const created = await tx.team.create({ data: { ...base(team as unknown as Record<string, unknown>, ['tournamentId', 'members']), tournamentId: tournament.id } });
      teamMap.set(team.id, created.id);
      for (const member of team.members) {
        const playerId = playerMap.get(member.playerId);
        if (playerId) await tx.teamPlayer.create({ data: { teamId: created.id, playerId } });
      }
    }

    const groupMap = new Map<string, string>();
    for (const g of src.groups) {
      const created = await tx.tournamentGroup.create({ data: { ...base(g as unknown as Record<string, unknown>, ['tournamentId']), tournamentId: tournament.id } });
      groupMap.set(g.id, created.id);
    }

    const courtMap = new Map<string, string>();
    for (const c of src.courts) {
      const created = await tx.court.create({ data: { ...base(c as unknown as Record<string, unknown>, ['tournamentId']), tournamentId: tournament.id } });
      courtMap.set(c.id, created.id);
    }

    const participantMap = new Map<string, string>();
    for (const part of src.participants) {
      const created = await tx.tournamentParticipant.create({
        data: {
          ...base(part as unknown as Record<string, unknown>, ['tournamentId', 'teamId', 'groupId']),
          tournamentId: tournament.id,
          teamId: teamMap.get(part.teamId)!,
          groupId: part.groupId ? groupMap.get(part.groupId) ?? null : null
        }
      });
      participantMap.set(part.id, created.id);
    }

    const matchMap = new Map<string, string>();
    for (const m of src.matches) {
      const created = await tx.match.create({
        data: {
          ...base(m as unknown as Record<string, unknown>, ['tournamentId', 'sets', 'result', 'mvpVotes', 'participantAId', 'participantBId', 'winnerId', 'courtId', 'groupId', 'parentMatchIdA', 'parentMatchIdB', 'scheduleSlotId']),
          tournamentId: tournament.id,
          groupId: m.groupId ? groupMap.get(m.groupId) ?? null : null,
          participantAId: m.participantAId ? participantMap.get(m.participantAId) ?? null : null,
          participantBId: m.participantBId ? participantMap.get(m.participantBId) ?? null : null,
          winnerId: m.winnerId ? participantMap.get(m.winnerId) ?? null : null,
          courtId: m.courtId ? courtMap.get(m.courtId) ?? null : null
        }
      });
      matchMap.set(m.id, created.id);
      for (const s of m.sets) await tx.matchSet.create({ data: { ...base(s as unknown as Record<string, unknown>, ['matchId']), matchId: created.id } });
      if (m.result) await tx.matchResult.create({ data: { ...base(m.result as unknown as Record<string, unknown>, ['matchId']), matchId: created.id } });
      for (const v of m.mvpVotes) {
        await tx.mVPVote.create({
          data: {
            ...base(v as unknown as Record<string, unknown>, ['tournamentId', 'matchId', 'playerId']),
            tournamentId: tournament.id,
            matchId: created.id,
            playerId: playerMap.get(v.playerId)!
          }
        });
      }
    }

    // Seconda passata: ricollega i tabelloni ai match clonati.
    for (const m of src.matches) {
      if (m.parentMatchIdA || m.parentMatchIdB) {
        await tx.match.update({
          where: { id: matchMap.get(m.id)! },
          data: {
            parentMatchIdA: m.parentMatchIdA ? matchMap.get(m.parentMatchIdA) ?? null : null,
            parentMatchIdB: m.parentMatchIdB ? matchMap.get(m.parentMatchIdB) ?? null : null
          }
        });
      }
    }

    return tournament;
  });

  return NextResponse.json({ tournament: cloned }, { status: 201 });
}
