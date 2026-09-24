import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext } from '@/lib/server/serialize';
import { buildCalendarPdfModel } from '@/lib/domain/calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE: [number, number] = [842, 595]; // A4 landscape
const M = 40;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.4, 0.44, 0.5);

// Tieni solo caratteri codificabili in WinAnsi (Helvetica standard di pdf-lib).
const safe = (s: string) => Array.from(s).map((ch) => { const c = ch.charCodeAt(0); if (c < 0x20 || c === 0x7f) return ' '; if (c >= 0x80 && c <= 0x9f) return '?'; if (c > 0xff) return '?'; return ch; }).join('');

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await prisma.tournament.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: tournamentInclude });
  if (!tournament) return NextResponse.json({ error: 'Torneo non trovato.' }, { status: 404 });

  const ctx = toDomainContext(tournament);
  const model = buildCalendarPdfModel({
    title: ctx.name,
    startsAt: ctx.startsAt ?? null,
    matches: ctx.matches,
    participantNames: new Map(ctx.participants.map((p) => [p.id, p.displayName])),
    groupNames: new Map(ctx.groups.map((g) => [g.id, g.name])),
    courtNames: new Map(ctx.courts.map((c) => [c.id, c.name]))
  });

  const doc = await PDFDocument.create();
  doc.setTitle(`${ctx.name} - Calendario`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const usable = PAGE[0] - 2 * M;
  const cols = model.showDay
    ? [{ h: 'Squadra A', w: 0.24 }, { h: 'Squadra B', w: 0.24 }, { h: 'Campo', w: 0.16 }, { h: 'Giorno', w: 0.13 }, { h: 'Ora', w: 0.09 }, { h: 'Risultato', w: 0.14 }]
    : [{ h: 'Squadra A', w: 0.28 }, { h: 'Squadra B', w: 0.28 }, { h: 'Campo', w: 0.2 }, { h: 'Ora', w: 0.11 }, { h: 'Risultato', w: 0.13 }];
  const widths = cols.map((c) => c.w * usable);
  const xs = widths.reduce<number[]>((acc, w, i) => { acc.push(i === 0 ? M : acc[i - 1] + widths[i - 1]); return acc; }, []);

  const clip = (text: string, maxW: number, f: typeof font, size: number) => {
    const t = safe(text);
    if (f.widthOfTextAtSize(t, size) <= maxW) return t;
    let out = t;
    while (out.length > 1 && f.widthOfTextAtSize(out + '...', size) > maxW) out = out.slice(0, -1);
    return out + '...';
  };

  let page = doc.addPage(PAGE);
  let y = PAGE[1] - M;
  const drawHeader = (big: boolean) => {
    if (big) {
      page.drawText(clip(model.title, usable, bold, 18), { x: M, y: PAGE[1] - 48, size: 18, font: bold, color: INK });
      y = PAGE[1] - 48;
      if (model.dateLabel) { page.drawText(clip(model.dateLabel, usable, font, 11), { x: M, y: y - 18, size: 11, font, color: MUTED }); y -= 18; }
    } else {
      page.drawText(clip(`${model.title} - Calendario`, usable, bold, 11), { x: M, y: PAGE[1] - 34, size: 11, font: bold, color: MUTED });
      y = PAGE[1] - 34;
    }
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE[0] - M, y }, thickness: 0.75, color: rgb(0.78, 0.81, 0.86) });
    y -= 20;
  };
  const drawCols = () => {
    cols.forEach((c, i) => page.drawText(clip(c.h, widths[i] - 6, bold, 8), { x: xs[i], y, size: 8, font: bold, color: MUTED }));
    y -= 16;
  };
  const drawRow = (values: string[]) => {
    values.forEach((v, i) => page.drawText(clip(v, widths[i] - 6, font, 9), { x: xs[i], y, size: 9, font, color: INK }));
    y -= 16;
  };
  drawHeader(true);

  if (model.sections.length === 0) {
    page.drawText('Nessuna partita in calendario.', { x: M, y, size: 11, font, color: MUTED });
  }
  for (const section of model.sections) {
    if (y - 44 < M) { page = doc.addPage(PAGE); drawHeader(false); }
    page.drawText(clip(section.label, usable, bold, 12), { x: M, y, size: 12, font: bold, color: INK });
    y -= 18;
    drawCols();
    for (const row of section.rows) {
      if (y - 14 < M) {
        page = doc.addPage(PAGE);
        drawHeader(false);
        page.drawText(clip(section.label, usable, bold, 10), { x: M, y, size: 10, font: bold, color: INK });
        y -= 18;
        drawCols();
      }
      const values = model.showDay ? [row.teamA, row.teamB, row.court, row.day, row.time, row.result] : [row.teamA, row.teamB, row.court, row.time, row.result];
      drawRow(values);
    }
    y -= 10;
  }

  const bytes = await doc.save();
  const base = (tournament.slug ?? tournament.id).replace(/[^a-z0-9\-_]+/gi, '-');
  const filename = `${base}-calendario.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
