/** 2D affine maths shared by canvas hit-tests and PDF output. All inputs in mm unless noted. */

/** Affine matrix [a, b, c, d, e, f] — same layout as PDF `cm` and Canvas `setTransform`. */
export type Matrix = readonly [number, number, number, number, number, number];
export type Point = { x: number; y: number };

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 · m2 — apply m2 first, then m1. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}

export const compose = (...ms: Matrix[]) => ms.reduce((acc, m) => multiply(acc, m), IDENTITY);
export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy = sx): Matrix => [sx, 0, 0, sy, 0, 0];
export function rotateDeg(deg: number): Matrix {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos, sin, -sin, cos, 0, 0];
}

export function apply(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export type Placement = {
  /** Centre position from the lid's top-left corner, in mm (y grows downward). */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** Clockwise in screen space, degrees. */
  rotationDeg: number;
  flipX?: boolean;
};

/** Item-local (centred, y-down) → lid mm space. */
export const placementMatrix = (p: Placement): Matrix => compose(translate(p.xMm, p.yMm), rotateDeg(p.rotationDeg), scale(p.flipX ? -1 : 1, 1));

export function corners(p: Placement): Point[] {
  const m = placementMatrix(p);
  const hw = p.widthMm / 2;
  const hh = p.heightMm / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((pt) => apply(m, pt));
}

export function boundingBox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, maxX: Math.max(...xs), maxY: Math.max(...ys), width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** Separating-axis test for two rotated rectangles. Touching edges do not count as overlap. */
export function rectsOverlap(a: Placement, b: Placement): boolean {
  const pa = corners(a);
  const pb = corners(b);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 4; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % 4];
      const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      const project = (pts: Point[]) => pts.map((p) => p.x * axis.x + p.y * axis.y);
      const ra = project(pa);
      const rb = project(pb);
      const eps = 1e-9;
      if (Math.max(...ra) <= Math.min(...rb) + eps || Math.max(...rb) <= Math.min(...ra) + eps) return false;
    }
  }
  return true;
}
