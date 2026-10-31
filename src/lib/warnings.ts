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

/**
 * Share of a back-lit logo hidden under stickers, 0 (all lit) to 1 (fully covered). Sampled on a grid
 * inside the ellipse that fits the logo box, a close stand-in for the apple silhouette. Stickers are
 * opaque, borders included; each one's rotated outer rectangle is used, as in the other checks.
 */
export function logoCoverage(items: LayoutItem[], logo: { x: number; y: number; width: number; height: number }, steps = 16): number {
  if (!items.length) return 0;
  const rects = items.map((it) => {
    const r = (it.rotationDeg * Math.PI) / 180;
    return { x: it.xMm, y: it.yMm, hw: it.widthMm / 2 + it.borderMm, hh: it.heightMm / 2 + it.borderMm, cos: Math.cos(r), sin: Math.sin(r) };
  });
  let total = 0;
  let hidden = 0;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const u = (i + 0.5) / steps - 0.5;
      const v = (j + 0.5) / steps - 0.5;
      if (u * u + v * v > 0.25) continue;
      total++;
      const px = logo.x + u * logo.width;
      const py = logo.y + v * logo.height;
      const under = rects.some((q) => {
        // Into the sticker's own frame (undo its clockwise rotation).
        const dx = px - q.x;
        const dy = py - q.y;
        const lx = dx * q.cos + dy * q.sin;
        const ly = -dx * q.sin + dy * q.cos;
        return Math.abs(lx) <= q.hw && Math.abs(ly) <= q.hh;
      });
      if (under) hidden++;
    }
  }
  return total ? hidden / total : 0;
}
