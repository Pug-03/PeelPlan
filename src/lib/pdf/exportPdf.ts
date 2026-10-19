import {
  PDFDocument,
  PDFPage,
  StandardFonts,
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setDashPattern,
  setFillingRgbColor,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  fill,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import { apply, compose, placementMatrix, scale, type Matrix } from "../geometry";
import { coordinateRows, type LayoutItem, type StickerAsset } from "../layout";
import { PT_PER_MM, mmToPt, roundMm } from "../scale";
import { PAPER, crosshairPoints, planTiles, type PaperSize, type Tile, type TilePlan } from "./tiling";

export type PdfMode = "guide" | "template";

export type PdfLid = {
  modelName: string;
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  logo?: { x: number; y: number; width: number; height: number };
};

export type PdfOptions = {
  paper: PaperSize["id"];
  mode: PdfMode;
  /** Print sticker artwork (guide mode only). */
  includeImages: boolean;
  /** Padding around the lid for dimension labels, mm. */
  paddingMm?: number;
};

const DEFAULT_PADDING_MM = 14;
const RULER_MM = 100;
const INK = { r: 0.07, g: 0.07, b: 0.07 };
const MUTED = { r: 0.45, g: 0.45, b: 0.47 };
const ACCENT = { r: 0.18, g: 0.36, b: 1 };

/**
 * Content space: mm, origin top-left of the padded lid area, y down.
 * Returns the PDF `cm` matrix that maps content mm onto a tile page (points, y up).
 */
export function contentToPageMatrix(plan: TilePlan, tile: Tile): Matrix {
  const m = plan.options.marginMm;
  const k = PT_PER_MM;
  return [k, 0, 0, -k, k * (m - tile.xMm), k * (plan.pageHeightMm - m + tile.yMm)];
}

/** Ruler geometry in page points (y up), bottom-left anchored in the footer band. */
export function rulerSegment(plan: TilePlan) {
  const m = plan.options.marginMm;
  const y = m + plan.options.footerMm * 0.55;
  return { x1: mmToPt(m), x2: mmToPt(m + RULER_MM), y: mmToPt(y) };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const KAPPA = 0.5522847498;

function roundedRectOps(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const c = rr * (1 - KAPPA);
  return [
    moveTo(x + rr, y),
    lineTo(x + w - rr, y),
    appendBezierCurve(x + w - c, y, x + w, y + c, x + w, y + rr),
    lineTo(x + w, y + h - rr),
    appendBezierCurve(x + w, y + h - c, x + w - c, y + h, x + w - rr, y + h),
    lineTo(x + rr, y + h),
    appendBezierCurve(x + c, y + h, x, y + h - c, x, y + h - rr),
    lineTo(x, y + rr),
    appendBezierCurve(x, y + c, x + c, y, x + rr, y),
    closePath(),
  ];
}

const color = (c: { r: number; g: number; b: number }) => [c.r, c.g, c.b] as const;

function crosshairOps(x: number, y: number, size: number) {
  return [moveTo(x - size, y), lineTo(x + size, y), moveTo(x, y - size), lineTo(x, y + size), stroke()];
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, c = INK) {
  page.drawText(text, { x, y, size, font, color: rgb(c.r, c.g, c.b) });
}

function drawRuler(page: PDFPage, font: PDFFont, plan: TilePlan) {
  const { x1, x2, y } = rulerSegment(plan);
  const ops = [pushGraphicsState(), setStrokingRgbColor(...color(INK)), setLineWidth(0.6), moveTo(x1, y), lineTo(x2, y), stroke()];
  for (let mm = 0; mm <= RULER_MM; mm++) {
    const len = mm % 10 === 0 ? 3 : mm % 5 === 0 ? 2 : 1.1;
    const x = x1 + mmToPt(mm);
    ops.push(setLineWidth(mm % 10 === 0 ? 0.5 : 0.25), moveTo(x, y), lineTo(x, y + mmToPt(len)), stroke());
  }
  ops.push(popGraphicsState());
  page.pushOperators(...ops);
  drawText(page, font, "0", x1 - 1.5, y - 8, 6);
  drawText(page, font, "100 mm", x2 - 10, y - 8, 6);
  drawText(page, font, 'This line must measure exactly 100 mm. Print at 100% / Actual size - NOT "Fit to page".', x1, y - 17, 7, MUTED);
}

type Ctx = {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  lid: PdfLid;
  items: LayoutItem[];
  images: Map<string, PDFImage>;
  opts: Required<PdfOptions>;
  contentW: number;
  contentH: number;
};

function drawTilePage(ctx: Ctx, plan: TilePlan, tile: Tile, pageIndex: number, pageCount: number) {
  const { doc, font, bold, lid, items, images, opts } = ctx;
  const pad = opts.paddingMm;
  const page = doc.addPage([mmToPt(plan.pageWidthMm), mmToPt(plan.pageHeightMm)]);
  const P = contentToPageMatrix(plan, tile);
  const m = plan.options.marginMm;

  // Clip to this tile's printable window, then enter content space (mm, y down).
  page.pushOperators(
    pushGraphicsState(),
    rectangle(mmToPt(m), mmToPt(plan.pageHeightMm - m - tile.heightMm), mmToPt(tile.widthMm), mmToPt(tile.heightMm)),
    clip(),
    endPath(),
    concatTransformationMatrix(...P),
  );

  // Lid outline.
  page.pushOperators(
    setStrokingRgbColor(...color(INK)),
    setLineWidth(0.35),
    ...roundedRectOps(pad, pad, lid.widthMm, lid.heightMm, lid.cornerRadiusMm),
    stroke(),
  );

  if (lid.logo) {
    const l = lid.logo;
    page.pushOperators(
      setStrokingRgbColor(...color(MUTED)),
      setLineWidth(0.2),
      setDashPattern([1.2, 1.2], 0),
      ...roundedRectOps(pad + l.x - l.width / 2, pad + l.y - l.height / 2, l.width, l.height, 3),
      stroke(),
      setDashPattern([], 0),
    );
  }

  for (const it of items) {
    const local = compose([1, 0, 0, 1, pad, pad] as Matrix, placementMatrix(it));
    const img = images.get(it.assetId);
    if (opts.mode === "guide" && opts.includeImages && img) {
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...compose(local, scale(1, -1))));
      page.drawImage(img, { x: -it.widthMm / 2, y: -it.heightMm / 2, width: it.widthMm, height: it.heightMm });
      page.pushOperators(popGraphicsState());
    }
    const b = it.borderMm;
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(...local),
      setStrokingRgbColor(...color(opts.mode === "template" ? INK : ACCENT)),
      setLineWidth(opts.mode === "template" ? 0.4 : 0.25),
      setDashPattern(opts.mode === "template" ? [2, 1] : [], 0),
      rectangle(-it.widthMm / 2 - b, -it.heightMm / 2 - b, it.widthMm + 2 * b, it.heightMm + 2 * b),
      stroke(),
      setDashPattern([], 0),
      setLineWidth(0.2),
      ...crosshairOps(0, 0, 2),
      popGraphicsState(),
    );
  }

  // Alignment crosshairs shared by neighbouring sheets.
  page.pushOperators(setStrokingRgbColor(...color(INK)), setLineWidth(0.2));
  for (const pt of crosshairPoints(plan, ctx.contentW, ctx.contentH)) {
    page.pushOperators(...crosshairOps(pt.x, pt.y, 4));
  }
  page.pushOperators(popGraphicsState());

  // Cut lines (dashed) through the middle of each overlap strip, where the crosshairs sit, on every
  // shared edge: trim along them and the crosshairs on neighbouring sheets meet exactly.
  const o = plan.options.overlapMm;
  const ov: unknown[] = [pushGraphicsState(), setStrokingRgbColor(...color(MUTED)), setLineWidth(0.4), setDashPattern([3, 2], 0)];
  const top = plan.pageHeightMm - m;
  const vCut = (xMm: number) => ov.push(moveTo(mmToPt(xMm), mmToPt(top)), lineTo(mmToPt(xMm), mmToPt(top - tile.heightMm)), stroke());
  const hCut = (yMm: number) => ov.push(moveTo(mmToPt(m), mmToPt(yMm)), lineTo(mmToPt(m + tile.widthMm), mmToPt(yMm)), stroke());
  if (tile.col < plan.cols - 1) vCut(m + tile.widthMm - o / 2);
  if (tile.col > 0) vCut(m + o / 2);
  if (tile.row < plan.rows - 1) hCut(top - tile.heightMm + o / 2);
  if (tile.row > 0) hCut(top - o / 2);
  ov.push(popGraphicsState());
  page.pushOperators(...(ov as Parameters<PDFPage["pushOperators"]>));

  // Labels: positioned via the same matrix so they land on the geometry they describe.
  const toPage = (x: number, y: number) => apply(P, { x, y });
  const inTile = (x: number, y: number) => x >= tile.xMm && x <= tile.xMm + tile.widthMm && y >= tile.yMm && y <= tile.yMm + tile.heightMm;
  const label = (text: string, x: number, y: number, size = 6.5, c = INK, f = font) => {
    if (!inTile(x, y)) return;
    const p = toPage(x, y);
    page.drawText(text, { x: p.x, y: p.y, size, font: f, color: rgb(c.r, c.g, c.b) });
  };
  label(`${roundMm(lid.widthMm)} mm`, pad + lid.widthMm / 2 - 6, pad - 3);
  label(`${roundMm(lid.heightMm)} mm`, pad - 12, pad + lid.heightMm / 2);
  label(`${lid.modelName} - hinge side at bottom`, pad + 2, pad + lid.heightMm + 6, 6.5, MUTED);
  items.forEach((it, i) => {
    label(`#${i + 1}`, pad + it.xMm + 1.5, pad + it.yMm - 1.5, 7, INK, bold);
    label(`x ${roundMm(it.xMm)}  y ${roundMm(it.yMm)}`, pad + it.xMm + 1.5, pad + it.yMm + 3.5, 5.5, MUTED);
  });

  drawRuler(page, font, plan);
  const footer = `Sheet ${tile.label}  (${pageIndex} / ${pageCount})${opts.mode === "template" ? "  -  CUT-OUT TEMPLATE: cut along dashed outlines" : ""}`;
  drawText(page, bold, footer, mmToPt(m + RULER_MM + 8), rulerSegment(plan).y - 1, 7);
}

function drawCoverPage(ctx: Ctx, plan: TilePlan) {
  const { doc, font, bold, lid } = ctx;
  const page = doc.addPage([mmToPt(plan.pageWidthMm), mmToPt(plan.pageHeightMm)]);
  const H = mmToPt(plan.pageHeightMm);
  const left = mmToPt(plan.options.marginMm + 5);
  let y = H - mmToPt(25);
  const line = (text: string, size = 10, f = font, c = INK, gap = 6) => {
    drawText(page, f, text, left, y, size, c);
    y -= mmToPt(gap);
  };
  line("PeelPlan - 1:1 placement guide", 18, bold, INK, 10);
  line(`${lid.modelName}  |  lid ${roundMm(lid.widthMm)} x ${roundMm(lid.heightMm)} mm  |  ${ctx.items.length} stickers`, 10, font, MUTED, 10);
  line("Before you print", 12, bold, INK, 7);
  line('1. In the print dialog choose Scale: 100% / Actual size. Turn OFF "Fit to page" / "Shrink".');
  line(`2. Paper: ${plan.paper.id === "a4" ? "A4" : "US Letter"}${plan.landscape ? " (landscape)" : ""}. ${plan.tiles.length} sheet(s) after this page.`);
  line("3. Measure the ruler below with a real ruler. It must be exactly 100 mm. If not, check scaling.");
  if (plan.tiles.length > 1) {
    line("4. Cut along the dashed lines, butt the sheets edge to edge so the crosshairs meet, then tape.");
  }
  y -= mmToPt(6);

  // Horizontal and vertical 100 mm checks (verifies both printer axes).
  const x1 = left;
  const yH = y;
  const ops = [pushGraphicsState(), setStrokingRgbColor(...color(INK)), setLineWidth(0.8), moveTo(x1, yH), lineTo(x1 + mmToPt(100), yH), stroke()];
  for (let mm = 0; mm <= 100; mm += 1) {
    const len = mm % 10 === 0 ? 4 : mm % 5 === 0 ? 2.5 : 1.3;
    ops.push(setLineWidth(mm % 10 === 0 ? 0.5 : 0.25), moveTo(x1 + mmToPt(mm), yH), lineTo(x1 + mmToPt(mm), yH + mmToPt(len)), stroke());
  }
  const xV = x1 + mmToPt(130);
  ops.push(setLineWidth(0.8), moveTo(xV, yH), lineTo(xV, yH - mmToPt(100)), stroke());
  for (let mm = 0; mm <= 100; mm += 10) ops.push(setLineWidth(0.5), moveTo(xV, yH - mmToPt(mm)), lineTo(xV + mmToPt(4), yH - mmToPt(mm)), stroke());
  // 50 mm square: both sides should match.
  ops.push(setFillingRgbColor(0.97, 0.97, 0.98), rectangle(x1, yH - mmToPt(70), mmToPt(50), mmToPt(50)), fill());
  ops.push(setLineWidth(0.4), rectangle(x1, yH - mmToPt(70), mmToPt(50), mmToPt(50)), stroke(), popGraphicsState());
  page.pushOperators(...ops);
  drawText(page, bold, "100 mm", x1 + mmToPt(40), yH - mmToPt(6), 9);
  drawText(page, bold, "100 mm", xV + mmToPt(6), yH - mmToPt(52), 9);
  drawText(page, font, "50 x 50 mm square", x1 + mmToPt(8), yH - mmToPt(46), 8, MUTED);
}

function drawCoordinatePage(ctx: Ctx, plan: TilePlan) {
  const { doc, font, bold, items } = ctx;
  const rows = coordinateRows(items);
  const H = mmToPt(plan.pageHeightMm);
  const left = mmToPt(plan.options.marginMm + 5);
  const cols = [0, 12, 70, 100, 130, 160];
  const header = ["#", "Sticker", "X from left", "Y from top", "Size (w x h)", "Rotation (CW)"];
  let page = doc.addPage([mmToPt(plan.pageWidthMm), H]);
  let y = H - mmToPt(25);
  const heading = () => {
    drawText(page, bold, "Coordinate sheet (sticker centre, mm from lid edges, hinge at bottom)", left, y, 11);
    y -= mmToPt(10);
    header.forEach((h, i) => drawText(page, bold, h, left + mmToPt(cols[i]), y, 8));
    y -= mmToPt(6);
  };
  heading();
  for (const r of rows) {
    if (y < mmToPt(plan.options.marginMm + 10)) {
      page = doc.addPage([mmToPt(plan.pageWidthMm), H]);
      y = H - mmToPt(25);
      heading();
    }
    const cells = [
      String(r.index),
      r.label.slice(0, 28),
      `${roundMm(r.xMm)} mm`,
      `${roundMm(r.yMm)} mm`,
      `${roundMm(r.widthMm)} x ${roundMm(r.heightMm)}`,
      `${roundMm(r.rotationDeg)} deg CW${r.flipped ? " (flipped)" : ""}`,
    ];
    cells.forEach((c, i) => drawText(page, font, c.replace(/[^\x20-\x7E]/g, "?"), left + mmToPt(cols[i]), y, 8));
    y -= mmToPt(6);
  }
}

export async function exportLayoutPdf(lid: PdfLid, items: LayoutItem[], assets: Record<string, StickerAsset>, options: PdfOptions): Promise<Uint8Array> {
  const opts: Required<PdfOptions> = { paddingMm: DEFAULT_PADDING_MM, ...options };
  const doc = await PDFDocument.create();
  doc.setTitle(`PeelPlan 1:1 - ${lid.modelName}`);
  doc.setCreator("PeelPlan");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const images = new Map<string, PDFImage>();
  if (opts.mode === "guide" && opts.includeImages) {
    for (const id of new Set(items.map((i) => i.assetId))) {
      const a = assets[id];
      if (a?.src.startsWith("data:image/png")) images.set(id, await doc.embedPng(dataUrlToBytes(a.src)));
    }
  }

  const contentW = lid.widthMm + 2 * opts.paddingMm;
  const contentH = lid.heightMm + 2 * opts.paddingMm;
  const plan = planTiles(contentW, contentH, PAPER[opts.paper]);
  const ctx: Ctx = { doc, font, bold, lid, items, images, opts, contentW, contentH };

  drawCoverPage(ctx, plan);
  plan.tiles.forEach((t, i) => drawTilePage(ctx, plan, t, i + 1, plan.tiles.length));
  if (items.length) drawCoordinatePage(ctx, plan);
  return doc.save();
}
