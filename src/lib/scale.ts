/**
 * Single source of truth for physical-unit conversions.
 *
 * Every stored dimension in PeelPlan is in millimetres. Pixels and PDF points
 * are render-time derivatives and must always be produced through this module.
 */

export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;
export const PT_PER_MM = PT_PER_INCH / MM_PER_INCH;

/** CSS reference pixel density (96 px per CSS inch). Not physical: screens vary. */
export const CSS_PX_PER_MM = 96 / MM_PER_INCH;

/** ISO/IEC 7810 ID-1 card (credit / ID card). */
export const ID1_CARD_MM = { width: 85.6, height: 53.98 } as const;

export const mmToPx = (mm: number, pxPerMm: number) => mm * pxPerMm;
export const pxToMm = (px: number, pxPerMm: number) => px / pxPerMm;
export const mmToPt = (mm: number) => mm * PT_PER_MM;
export const ptToMm = (pt: number) => pt / PT_PER_MM;
export const mmToIn = (mm: number) => mm / MM_PER_INCH;
export const inToMm = (inch: number) => inch * MM_PER_INCH;

/** pxPerMm from the on-screen width (CSS px) that matched a physical card edge. */
export function pxPerMmFromReference(measuredPx: number, referenceMm = ID1_CARD_MM.width) {
  if (!(measuredPx > 0) || !(referenceMm > 0)) throw new RangeError("Reference sizes must be positive");
  return measuredPx / referenceMm;
}

/** Largest pxPerMm that fits a `widthMm × heightMm` object inside a viewport with padding. */
export function fitPxPerMm(widthMm: number, heightMm: number, viewportPx: { width: number; height: number }, paddingPx = 0) {
  const w = Math.max(1, viewportPx.width - paddingPx * 2);
  const h = Math.max(1, viewportPx.height - paddingPx * 2);
  return Math.min(w / widthMm, h / heightMm);
}

/** mm scale from two points in an image (px) spanning a known reference length (mm). */
export function mmPerImagePx(a: { x: number; y: number }, b: { x: number; y: number }, referenceMm: number) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d === 0) throw new RangeError("Reference points must differ");
  return referenceMm / d;
}

/** Resize keeping aspect ratio: give one side in mm, get both. */
export function sizeFromOneSide(aspect: number, side: { widthMm: number } | { heightMm: number }) {
  if ("widthMm" in side) return { widthMm: side.widthMm, heightMm: side.widthMm / aspect };
  return { widthMm: side.heightMm * aspect, heightMm: side.heightMm };
}

/** Round for display only. Never round stored values. */
export const roundMm = (mm: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(mm * f) / f;
};

export function formatLength(mm: number, opts: { secondaryInches?: boolean; digits?: number } = {}) {
  const main = `${roundMm(mm, opts.digits ?? 1)} mm`;
  return opts.secondaryInches ? `${main} (${mmToIn(mm).toFixed(2)}″)` : main;
}
