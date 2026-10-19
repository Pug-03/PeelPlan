import { rectsOverlap } from "./geometry";
import type { LayoutItem } from "./layout";
import { LOGO_CLEARANCE_MM } from "./warnings";

const STEP_MM = 5;
const MARGIN_MM = 8;

/**
 * First position (scanning rows from the top-left) where a new sticker overlaps nothing,
 * stays clear of the logo zone when requested, and keeps a margin from the lid edge.
 * When full it retries without margins, then falls back to the top-left corner (never the logo).
 */
export function findFreeSpot(
  size: { widthMm: number; heightMm: number },
  items: LayoutItem[],
  lid: { widthMm: number; heightMm: number; logo?: { x: number; y: number; width: number; height: number } },
  avoidLogo: boolean,
): { xMm: number; yMm: number } {
  const obstacles = items.map((i) => ({ ...i, widthMm: i.widthMm + 2 * i.borderMm + 4, heightMm: i.heightMm + 2 * i.borderMm + 4 }));
  if (avoidLogo && lid.logo)
    obstacles.push({
      xMm: lid.logo.x,
      yMm: lid.logo.y,
      widthMm: lid.logo.width + 2 * LOGO_CLEARANCE_MM,
      heightMm: lid.logo.height + 2 * LOGO_CLEARANCE_MM,
      rotationDeg: 0,
    } as LayoutItem);
  const hw = size.widthMm / 2;
  const hh = size.heightMm / 2;
  for (let y = MARGIN_MM + hh; y <= lid.heightMm - MARGIN_MM - hh; y += STEP_MM) {
    for (let x = MARGIN_MM + hw; x <= lid.widthMm - MARGIN_MM - hw; x += STEP_MM) {
      const cand = { xMm: x, yMm: y, widthMm: size.widthMm, heightMm: size.heightMm, rotationDeg: 0 };
      if (!obstacles.some((o) => rectsOverlap(cand, o))) return { xMm: x, yMm: y };
    }
  }
  // Full lid: drop the spacing and edge margin, but still keep off the logo and other stickers.
  const tight = obstacles.map((o, i) => (i < items.length ? { ...o, widthMm: o.widthMm - 4, heightMm: o.heightMm - 4 } : o));
  for (let y = hh; y <= lid.heightMm - hh; y += 2)
    for (let x = hw; x <= lid.widthMm - hw; x += 2) {
      const cand = { xMm: x, yMm: y, widthMm: size.widthMm, heightMm: size.heightMm, rotationDeg: 0 };
      if (!tight.some((o) => rectsOverlap(cand, o))) return { xMm: x, yMm: y };
    }
  // Truly no room: top-left corner, so it never lands on the centred logo.
  const n = items.length % 6;
  return { xMm: hw + n * 6, yMm: hh + n * 6 };
}
