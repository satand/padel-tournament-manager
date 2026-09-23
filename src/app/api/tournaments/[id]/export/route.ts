import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp } from '@/lib/server/serialize';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant } from '@/lib/domain/mvp';
import { bracketLabel } from '@/lib/domain/labels';
import { bracketPhaseReached, bracketPlacements, generalPhaseReached } from '@/lib/domain/finals';
import { bracketRankingsToCsv, groupRankingsToCsv, matchesToCsv, mvpToCsv, rankingToCsv } from '@/lib/domain/exports';

const TYPES = ['calendar', 'ranking', 'groups', 'finals', 'mvp'] as const;
type ExportType = (typeof TYPES)[number];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const type = (url.searchParams.get('type') ?? 'calendar') as ExportType;
  if (!TYPES.includes(type)) return NextResponse.json({ error: 'Tipo di export non valido.' }, { status: 400 });

  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: tournamentInclude
  });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const ctx = toDomainContext(tournament);
  const names = new Map(ctx.participants.map((p) => [p.id, p.displayName]));
  const groupNames = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const courtNames = new Map(ctx.courts.map((c) => [c.id, c.name]));
  const avgMvp = averageMvpRatingByParticipant(ctx.participants, ctx.mvpVotes);

  let csv = '';
  if (type === 'calendar') csv = matchesToCsv(ctx.matches, { participantNames: names, groupNames, courtNames });
  else if (type === 'ranking') csv = rankingToCsv(calculateRanking(ctx.participants, ctx.matches, ctx.rules, avgMvp), generalPhaseReached(ctx.participants, ctx.matches, ctx.groups.length > 0 ? 'Gironi' : '—'));
  else if (type === 'finals') {
    const finals = ctx.matches.filter((m) => !!m.phase && m.phase !== 'group');
    const entries = bracketPlacements(ctx.participants, ctx.matches).map((t) => {
      const ms = finals.filter((m) => (m.bracket ?? null) === t.bracket);
      const ids = new Set(ms.flatMap((m) => [m.participantAId, m.participantBId]).filter((x): x is string => !!x));
      return {
        tabellone: t.bracket ? `Tabellone ${bracketLabel(t.bracket)}` : 'Tabellone',
        rows: calculateRanking(ctx.participants.filter((p) => ids.has(p.id)), ms, ctx.rules, avgMvp),
        phaseReached: bracketPhaseReached(t)
      };
    });
    csv = bracketRankingsToCsv(entries);
  } else if (type === 'mvp') csv = mvpToCsv(computeMvp(ctx).rows);
  else {
    const groups = ctx.groups.length > 0
      ? ctx.groups.map((g) => ({ name: g.name, rows: calculateRanking(ctx.participants.filter((p) => p.groupId === g.id), ctx.matches.filter((m) => m.groupId === g.id), ctx.rules, avgMvp) }))
      : [{ name: 'Generale', rows: calculateRanking(ctx.participants, ctx.matches, ctx.rules, avgMvp) }];
    csv = groupRankingsToCsv(groups);
  }

  const base = (tournament.slug ?? tournament.id).replace(/[^a-z0-9\-_]+/gi, '-');
  const filename = `${base}-${type}.csv`;
  return new NextResponse('\ufeff' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
