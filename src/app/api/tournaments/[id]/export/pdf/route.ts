import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp } from '@/lib/server/serialize';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant } from '@/lib/domain/mvp';
import { generalPhaseReached } from '@/lib/domain/finals';
import { buildMvpPdfModel, buildParticipantsPdfModel, buildRankingPdfModel } from '@/lib/domain/pdfmodels';
import { renderTablePdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['participants', 'ranking', 'mvp'] as const;
type ExportType = (typeof TYPES)[number];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const type = (url.searchParams.get('type') ?? 'participants') as ExportType;
  if (!TYPES.includes(type)) return NextResponse.json({ error: 'Tipo di export non valido.' }, { status: 400 });

  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: tournamentInclude
  });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const ctx = toDomainContext(tournament);
  const avgMvp = averageMvpRatingByParticipant(ctx.participants, ctx.mvpVotes);
  const dateLabel = ctx.startsAt
    ? new Date(ctx.startsAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const model =
    type === 'ranking'
      ? buildRankingPdfModel({
          title: ctx.name,
          rows: calculateRanking(ctx.participants, ctx.matches, ctx.rules, avgMvp),
          phaseReached: generalPhaseReached(ctx.participants, ctx.matches, ctx.groups.length > 0 ? 'Gironi' : '—'),
          dateLabel
        })
      : type === 'mvp'
        ? buildMvpPdfModel({ title: ctx.name, rows: computeMvp(ctx).rows, dateLabel })
        : buildParticipantsPdfModel({ title: ctx.name, participants: ctx.participants, groups: ctx.groups, dateLabel });

  const bytes = await renderTablePdf(model);
  const base = (tournament.slug ?? tournament.id).replace(/[^a-z0-9\-_]+/gi, '-');
  const filename = `${base}-${type}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
