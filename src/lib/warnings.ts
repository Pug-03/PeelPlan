import { boundingBox, corners, rectsOverlap } from "./geometry";
import type { LayoutItem } from "./layout";

export const MIN_EDGE_MARGIN_MM = 3;
/** Clearance around the logo used by warnings, placement and the drawn no-go box. */
export const LOGO_CLEARANCE_MM = 4;

export type LayoutWarnings = {
  overlapping: Set<string>;
  onLogo: Set<string>;
  nearEdge: Set<string>;
};

/** Advisory checks only; the editor never blocks a placement. Uses each sticker's rotated outer rectangle. */
export function layoutWarnings(
  items: LayoutItem[],
  lid: { widthMm: number; heightMm: number; logo?: { x: number; y: number; width: number; height: number } },
  keepLogoClear: boolean,
): LayoutWarnings {
  const grown = items.map((it) => ({ ...it, widthMm: it.widthMm + 2 * it.borderMm, heightMm: it.heightMm + 2 * it.borderMm }));
  const overlapping = new Set<string>();
  for (let i = 0; i < grown.length; i++) {
    for (let j = i + 1; j < grown.length; j++) {
      if (rectsOverlap(grown[i], grown[j])) {
        overlapping.add(grown[i].id);
        overlapping.add(grown[j].id);
      }
    }
  }
  const onLogo = new Set<string>();
  if (keepLogoClear && lid.logo) {
    const l = lid.logo;
    const zone = { xMm: l.x, yMm: l.y, widthMm: l.width + 2 * LOGO_CLEARANCE_MM, heightMm: l.height + 2 * LOGO_CLEARANCE_MM, rotationDeg: 0 };
    for (const g of grown) if (rectsOverlap(g, zone)) onLogo.add(g.id);
  }
  const nearEdge = new Set<string>();
  for (const g of grown) {
    const b = boundingBox(corners(g));
    if (b.minX < MIN_EDGE_MARGIN_MM || b.minY < MIN_EDGE_MARGIN_MM || b.maxX > lid.widthMm - MIN_EDGE_MARGIN_MM || b.maxY > lid.heightMm - MIN_EDGE_MARGIN_MM)
      nearEdge.add(g.id);
  }
  return { overlapping, onLogo, nearEdge };
}
