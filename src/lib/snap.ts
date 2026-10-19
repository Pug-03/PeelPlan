/** Snap guides for dragging stickers on the lid. Everything in lid mm. */

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

export type Guide =
  | { kind: "line"; axis: "x" | "y"; at: number; from: number; to: number }
  | { kind: "gap"; axis: "x" | "y"; a: number; b: number; cross: number; gapMm: number };

export type SnapResult = { dx: number; dy: number; guides: Guide[] };

type Candidate = { delta: number; guide: Guide };

const mid = (a: number, b: number) => (a + b) / 2;

/**
 * @param moving bbox of the dragged selection
 * @param others bboxes of the stationary stickers
 * @param lid lid size; snaps to centre lines, edges, and edges inset by `marginMm`
 * @param thresholdMm snap distance
 */
export function computeSnap(moving: Box, others: Box[], lid: { widthMm: number; heightMm: number }, thresholdMm: number, marginMm = 5): SnapResult {
  const result: SnapResult = { dx: 0, dy: 0, guides: [] };
  for (const axis of ["x", "y"] as const) {
    const lo = axis === "x" ? moving.minX : moving.minY;
    const hi = axis === "x" ? moving.maxX : moving.maxY;
    const c = mid(lo, hi);
    const size = axis === "x" ? lid.widthMm : lid.heightMm;
    const crossLo = axis === "x" ? moving.minY : moving.minX;
    const crossHi = axis === "x" ? moving.maxY : moving.maxX;
    const span = axis === "x" ? lid.heightMm : lid.widthMm;

    const candidates: Candidate[] = [];
    const line = (target: number, own: number, from = 0, to = span) =>
      candidates.push({ delta: target - own, guide: { kind: "line", axis, at: target, from, to } });

    // Lid: centre, edges, and safe margin.
    line(size / 2, c);
    line(0, lo);
    line(size, hi);
    line(marginMm, lo);
    line(size - marginMm, hi);

    // Other stickers: align edges and centres.
    for (const o of others) {
      const oLo = axis === "x" ? o.minX : o.minY;
      const oHi = axis === "x" ? o.maxX : o.maxY;
      const oc = mid(oLo, oHi);
      const ocLo = axis === "x" ? o.minY : o.minX;
      const ocHi = axis === "x" ? o.maxY : o.maxX;
      const from = Math.min(crossLo, ocLo);
      const to = Math.max(crossHi, ocHi);
      line(oc, c, from, to);
      line(oLo, lo, from, to);
      line(oHi, hi, from, to);
      line(oLo, hi, from, to);
      line(oHi, lo, from, to);
    }

    // Equal spacing: continue the gap between two neighbours that share the moving item's cross band.
    const inBand = others.filter((o) => {
      const a = axis === "x" ? o.minY : o.minX;
      const b = axis === "x" ? o.maxY : o.maxX;
      return a < crossHi && b > crossLo;
    });
    const sorted = [...inBand].sort((p, q) => (axis === "x" ? p.minX - q.minX : p.minY - q.minY));
    for (let i = 0; i < sorted.length - 1; i++) {
      const A = sorted[i];
      const B = sorted[i + 1];
      const aHi = axis === "x" ? A.maxX : A.maxY;
      const bLo = axis === "x" ? B.minX : B.minY;
      const bHi = axis === "x" ? B.maxX : B.maxY;
      const aLo = axis === "x" ? A.minX : A.minY;
      const gap = bLo - aHi;
      if (gap <= 0) continue;
      const cross = mid(crossLo, crossHi);
      candidates.push({ delta: bHi + gap - lo, guide: { kind: "gap", axis, a: bHi, b: bHi + gap, cross, gapMm: gap } });
      candidates.push({ delta: aLo - gap - hi, guide: { kind: "gap", axis, a: aLo - gap, b: aLo, cross, gapMm: gap } });
    }

    let best: Candidate | null = null;
    for (const cand of candidates) {
      if (Math.abs(cand.delta) <= thresholdMm && (!best || Math.abs(cand.delta) < Math.abs(best.delta))) best = cand;
    }
    if (best) {
      if (axis === "x") result.dx = best.delta;
      else result.dy = best.delta;
      // Keep every guide that coincides with the winning snap.
      for (const cand of candidates) if (Math.abs(cand.delta - best.delta) < 1e-6) result.guides.push(cand.guide);
    }
  }
  return result;
}
