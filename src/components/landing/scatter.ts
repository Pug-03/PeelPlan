import type { ArtSticker } from "@/components/LidArt";
import { VISIBLE_LIBRARY } from "@/stickers/library";

/** In-house coding stickers (always shipped), used to fill lids whose example art is demo-only. */
export const IN_HOUSE_CODE = VISIBLE_LIBRARY.filter((s) => s.id.startsWith("code-") && !s.demo).map((s) => s.id);

/** Never fewer stickers than this on an example lid. */
export const MIN_STICKERS = 3;

const libSize = new Map(VISIBLE_LIBRARY.map((s) => [s.id, { w: s.widthMm, aspect: s.viewBox[1] / s.viewBox[0] }]));
/** Deterministic pseudo-random per lid, so server and client agree. */
const seeded = (seed: number) => () => ((seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);

/**
 * Spread `ids` over a lid: a loose grid with jitter and tilt. Sparse lids keep the logo clear;
 * busy ones shrink stickers to fit their cell and overlap a little, like a real well-used laptop.
 */
export function scatter(ids: string[], g: { widthMm: number; heightMm: number }, seed: number): ArtSticker[] {
  const rnd = seeded(seed + 1);
  const n = ids.length;
  // Keep every sticker fully on the lid (rotation adds a little slack).
  const place = (id: string, fx: number, fy: number, w: number, r: number): ArtSticker => {
    const h = w * (libSize.get(id)?.aspect ?? 1);
    const mx = w / 2 + 7;
    const my = h / 2 + 7;
    const x = Math.min(g.widthMm - mx, Math.max(mx, fx));
    const y = Math.min(g.heightMm - my, Math.max(my, fy));
    return { id, x: Math.round(x), y: Math.round(y), w: Math.round(w), r };
  };
  const natural = (id: string) => libSize.get(id)?.w ?? 50;
  // Hand-placed spots for sparse lids, all clear of the logo in the middle.
  const SPOTS: Record<number, [number, number, number][]> = {
    1: [[0.72, 0.68, -6]],
    2: [[0.24, 0.3, -8], [0.76, 0.7, 7]],
    3: [[0.2, 0.28, -7], [0.8, 0.32, 8], [0.62, 0.76, -4]],
    4: [[0.2, 0.27, -8], [0.8, 0.27, 6], [0.22, 0.74, 5], [0.79, 0.73, -7]],
  };
  if (SPOTS[n]) return ids.map((id, i) => place(id, g.widthMm * SPOTS[n][i][0], g.heightMm * SPOTS[n][i][1], natural(id), SPOTS[n][i][2]));

  const cols = Math.ceil(Math.sqrt(n * (g.widthMm / g.heightMm)));
  const rows = Math.ceil(n / cols);
  const cw = g.widthMm / cols;
  const ch = g.heightMm / rows;
  return ids.map((id, i) => {
    const r = Math.floor(i / cols);
    // Centre a short last row instead of leaving it ragged on the left.
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = (i % cols) + (cols - inRow) / 2;
    const x = (c + 0.5) * cw + (rnd() - 0.5) * cw * 0.3;
    const y = (r + 0.5) * ch + (rnd() - 0.5) * ch * 0.3;
    // Busy lids: stickers shrink to their cell (overlapping a little), never past real size.
    const aspect = libSize.get(id)?.aspect ?? 1;
    const w = Math.min(natural(id), cw * 1.02, (ch * 1.1) / aspect);
    return place(id, x, y, w, Math.round((rnd() - 0.5) * 24));
  });
}


/**
 * Pick `count` visible stickers for an example lid: its own first, then from `pool`, skipping repeats
 * and anything hidden in this build (demo-only art), so a lid never ends up with fewer than MIN_STICKERS.
 */
export function pickStickers(own: string[], pool: string[], count: number, offset = 0) {
  const want = Math.max(MIN_STICKERS, count);
  const out: string[] = [];
  // Last resort: the in-house code stickers, so a build without demo art never shows a bare lid.
  const filler = [...IN_HOUSE_CODE.slice(offset % IN_HOUSE_CODE.length), ...IN_HOUSE_CODE.slice(0, offset % IN_HOUSE_CODE.length)];
  for (const id of [...own, ...pool, ...filler]) {
    if (out.length >= want) break;
    if (libSize.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * A hand-made example layout as shown in this build: kept as is when enough of its stickers are
 * visible, otherwise rebuilt from what is visible plus in-house fillers.
 */
export function visibleLayout(stickers: ArtSticker[], g: { widthMm: number; heightMm: number }, count = 6, variant = 0): ArtSticker[] {
  const shown = stickers.filter((s) => libSize.has(s.id));
  if (shown.length >= Math.min(count, stickers.length)) return shown;
  return scatter(pickStickers(shown.map((s) => s.id), [], count, variant * 11), g, 7 + variant);
}
