import { boundingBox, corners, rectsOverlap, type Placement } from "./geometry";
import type { LayoutItem } from "./layout";
import { LOGO_CLEARANCE_MM } from "./warnings";

const STEP_MM = 5;
const MARGIN_MM = 8;
/** Touching edges do not count as overlap; matches the epsilon in `rectsOverlap`. */
const EPS = 1e-9;
/**
 * Candidates the fine squeeze scan may try before giving up and letting the cascade place the
 * sticker. A full 16" lid of rotated stickers has ~22 000 of them; sweeping all of them froze the
 * tab for half a second per sticker, and by then the lid has no real gap left anyway.
 */
const FINE_BUDGET = 4000;

type Obstacle = { shape: Placement; box: ReturnType<typeof boundingBox>; axisAligned: boolean };

/** Bounding box per obstacle, computed once: the scan below tests tens of thousands of candidates. */
const toObstacles = (shapes: Placement[]): Obstacle[] =>
  shapes.map((shape) => ({
    shape,
    box: boundingBox(corners(shape)),
    // A quarter-turn obstacle *is* its bounding box, so the cheap test is already the exact answer.
    axisAligned: (((shape.rotationDeg % 90) + 90) % 90) < 1e-9,
  }));

/**
 * First position (scanning rows from the top-left, `step` mm apart) where an axis-aligned sticker of
 * `size` overlaps none of the obstacles and keeps `margin` from the lid edge. Null when there is none.
 */
function scan(
  size: { widthMm: number; heightMm: number },
  obstacles: Obstacle[],
  lid: { widthMm: number; heightMm: number },
  margin: number,
  step: number,
  budget = Infinity,
) {
  const hw = size.widthMm / 2;
  const hh = size.heightMm / 2;
  let left = budget;
  for (let y = margin + hh; y <= lid.heightMm - margin - hh; y += step)
    for (let x = margin + hw; x <= lid.widthMm - margin - hw; x += step) {
      if (left-- <= 0) return null;
      let free = true;
      for (const o of obstacles) {
        // The box test is exact as a rejection and rules out almost every candidate without the
        // full separating-axis pass, which is what used to make a full lid take ~0.5 s per sticker.
        if (x + hw <= o.box.minX + EPS || o.box.maxX <= x - hw + EPS || y + hh <= o.box.minY + EPS || o.box.maxY <= y - hh + EPS) continue;
        if (o.axisAligned || rectsOverlap({ xMm: x, yMm: y, widthMm: size.widthMm, heightMm: size.heightMm, rotationDeg: 0 }, o.shape)) {
          free = false;
          break;
        }
      }
      if (free) return { xMm: x, yMm: y };
    }
  return null;
}

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
  const spaced: Placement[] = items.map((i) => ({ ...i, widthMm: i.widthMm + 2 * i.borderMm + 4, heightMm: i.heightMm + 2 * i.borderMm + 4 }));
  const logo: Placement[] =
    avoidLogo && lid.logo
      ? [
          {
            xMm: lid.logo.x,
            yMm: lid.logo.y,
            widthMm: lid.logo.width + 2 * LOGO_CLEARANCE_MM,
            heightMm: lid.logo.height + 2 * LOGO_CLEARANCE_MM,
            rotationDeg: 0,
          },
        ]
      : [];
  const roomy = scan(size, toObstacles([...spaced, ...logo]), lid, MARGIN_MM, STEP_MM);
  if (roomy) return roomy;
  // Full lid: drop the spacing and edge margin, but still keep off the logo and other stickers.
  const tight: Placement[] = items.map((i) => ({ ...i, widthMm: i.widthMm + 2 * i.borderMm, heightMm: i.heightMm + 2 * i.borderMm }));
  const squeezed = scan(size, toObstacles([...tight, ...logo]), lid, 0, 2, FINE_BUDGET);
  if (squeezed) return squeezed;
  // Truly no room: top-left corner, so it never lands on the centred logo.
  const n = items.length % 6;
  return { xMm: size.widthMm / 2 + n * 6, yMm: size.heightMm / 2 + n * 6 };
}
