// Renderer PDF condiviso (pdf-lib) per gli export a tabella: Partecipanti / Classifica / MVP.
// Stile identico al calendario: A4 landscape, intestazione titolo+data, sezioni con colonne e righe, paging.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { TablePdfModel } from '@/lib/domain/pdfmodels';

const PAGE: [number, number] = [842, 595]; // A4 landscape
const M = 40;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.4, 0.44, 0.5);

// Tieni solo caratteri codificabili in WinAnsi (Helvetica standard di pdf-lib).
const safe = (s: string) => Array.from(s).map((ch) => { const c = ch.charCodeAt(0); if (c < 0x20 || c === 0x7f) return ' '; if (c >= 0x80 && c <= 0x9f) return '?'; if (c > 0xff) return '?'; return ch; }).join('');

export async function renderTablePdf(model: TablePdfModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${model.title} - ${model.subtitle}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const usable = PAGE[0] - 2 * M;

  const widths = model.columns.map((c) => c.w * usable);
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
      page.drawText(clip(`${model.title} - ${model.subtitle}`, usable, bold, 11), { x: M, y: PAGE[1] - 34, size: 11, font: bold, color: MUTED });
      y = PAGE[1] - 34;
    }
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE[0] - M, y }, thickness: 0.75, color: rgb(0.78, 0.81, 0.86) });
    y -= 20;
  };
  const drawCols = () => {
    model.columns.forEach((c, i) => page.drawText(clip(c.h, widths[i] - 6, bold, 8), { x: xs[i], y, size: 8, font: bold, color: MUTED }));
    y -= 16;
  };
  const drawRow = (values: string[]) => {
    values.forEach((v, i) => page.drawText(clip(v, widths[i] - 6, font, 9), { x: xs[i], y, size: 9, font, color: INK }));
    y -= 16;
  };

  drawHeader(true);

  const empty = model.sections.length === 0 || model.sections.every((s) => s.rows.length === 0);
  if (empty) {
    page.drawText(safe(model.emptyMessage ?? 'Nessun dato.'), { x: M, y, size: 11, font, color: MUTED });
    return new Uint8Array(await doc.save());
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
      drawRow(row);
    }
    y -= 10;
  }

  return new Uint8Array(await doc.save());
}
