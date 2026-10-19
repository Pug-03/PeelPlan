/** Splits a physical area (mm) across paper sheets with overlap. Pure maths, no PDF dependency. */

export type PaperSize = { id: "a4" | "letter"; widthMm: number; heightMm: number };

export const PAPER: Record<PaperSize["id"], PaperSize> = {
  a4: { id: "a4", widthMm: 210, heightMm: 297 },
  letter: { id: "letter", widthMm: 215.9, heightMm: 279.4 },
};

export type TileOptions = {
  /** Unprintable margin on every side (most home printers need ≥ 5 mm). */
  marginMm: number;
  /** Footer band reserved for ruler + tile label. */
  footerMm: number;
  /** Shared strip printed on both neighbouring sheets. */
  overlapMm: number;
};

export const DEFAULT_TILE_OPTIONS: TileOptions = { marginMm: 10, footerMm: 14, overlapMm: 15 };

export type Tile = {
  row: number;
  col: number;
  label: string;
  /** Region of the content (mm) shown on this sheet. */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type TilePlan = {
  paper: PaperSize;
  landscape: boolean;
  pageWidthMm: number;
  pageHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  cols: number;
  rows: number;
  tiles: Tile[];
  options: TileOptions;
};

function planFor(contentW: number, contentH: number, paper: PaperSize, landscape: boolean, o: TileOptions): TilePlan {
  const pageWidthMm = landscape ? paper.heightMm : paper.widthMm;
  const pageHeightMm = landscape ? paper.widthMm : paper.heightMm;
  const printableWidthMm = pageWidthMm - 2 * o.marginMm;
  const printableHeightMm = pageHeightMm - 2 * o.marginMm - o.footerMm;
  const count = (content: number, printable: number) => (content <= printable ? 1 : Math.ceil((content - o.overlapMm) / (printable - o.overlapMm)));
  const cols = count(contentW, printableWidthMm);
  const rows = count(contentH, printableHeightMm);
  const stepX = printableWidthMm - o.overlapMm;
  const stepY = printableHeightMm - o.overlapMm;
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xMm = c * stepX;
      const yMm = r * stepY;
      tiles.push({
        row: r,
        col: c,
        label: `${String.fromCharCode(65 + r)}${c + 1}`,
        xMm,
        yMm,
        widthMm: Math.min(printableWidthMm, contentW - xMm),
        heightMm: Math.min(printableHeightMm, contentH - yMm),
      });
    }
  }
  return { paper, landscape, pageWidthMm, pageHeightMm, printableWidthMm, printableHeightMm, cols, rows, tiles, options: o };
}

/** Picks the orientation that needs the fewest sheets (portrait wins ties). */
export function planTiles(contentWidthMm: number, contentHeightMm: number, paper: PaperSize, options = DEFAULT_TILE_OPTIONS): TilePlan {
  const portrait = planFor(contentWidthMm, contentHeightMm, paper, false, options);
  const landscape = planFor(contentWidthMm, contentHeightMm, paper, true, options);
  return landscape.tiles.length < portrait.tiles.length ? landscape : portrait;
}

/** Centres of every overlap intersection/edge, where alignment crosshairs go (content mm). */
export function crosshairPoints(plan: TilePlan, contentWidthMm: number, contentHeightMm: number) {
  const o = plan.options.overlapMm;
  const xs = [0, ...Array.from({ length: plan.cols - 1 }, (_, i) => (i + 1) * (plan.printableWidthMm - o) + o / 2), contentWidthMm];
  const ys = [0, ...Array.from({ length: plan.rows - 1 }, (_, i) => (i + 1) * (plan.printableHeightMm - o) + o / 2), contentHeightMm];
  const pts: { x: number; y: number }[] = [];
  for (const x of xs) for (const y of ys) if ((x !== 0 && x !== contentWidthMm) || (y !== 0 && y !== contentHeightMm)) pts.push({ x, y });
  return pts;
}
