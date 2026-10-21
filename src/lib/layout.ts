import type { Placement } from "./geometry";

export type Finish = "glossy" | "matte" | "transparent";

export type LayoutItem = Placement & {
  id: string;
  /** Key into the sticker asset store (data URL lives there, not in the layout). */
  assetId: string;
  label: string;
  locked: boolean;
  finish: Finish;
  /** Die-cut white border width in mm; 0 = none. Drawn outside widthMm/heightMm. */
  borderMm: number;
};

export type StickerAsset = {
  id: string;
  /** PNG data URL with transparency. */
  src: string;
  pxWidth: number;
  pxHeight: number;
  /** Size suggested when first placed. */
  defaultWidthMm: number;
  source: "upload" | "library";
  /** Library artwork revision the raster was made from (see ART_VERSION). */
  rev?: number;
};

export type Layout = {
  version: 1;
  modelId: string;
  colorId: string;
  keepLogoClear: boolean;
  items: LayoutItem[];
};

/** Coordinate sheet row: centre position from lid edges. */
export function coordinateRows(items: LayoutItem[]) {
  return items.map((it, i) => ({
    index: i + 1,
    label: it.label,
    xMm: it.xMm,
    yMm: it.yMm,
    widthMm: it.widthMm,
    heightMm: it.heightMm,
    rotationDeg: ((it.rotationDeg % 360) + 360) % 360,
    flipped: !!it.flipX,
  }));
}

const FINISHES: Finish[] = ["glossy", "matte", "transparent"];
const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

/* Limits `parseLayout` enforces on the way in. The editor clamps to the same numbers on the way
   out (see `clampItem`), so a layout it produced always parses back. */

export const MAX_ITEMS = 200;
export const MIN_SIZE_MM = 1;
export const MAX_SIZE_MM = 600;
/** How far outside the lid a sticker centre may be parked, in mm. Well inside the ±500/1000 accepted below. */
export const POSITION_MARGIN_MM = 50;

/** Bounds for a sticker centre on a lid of this size, in mm. */
export const positionRange = (lid: { widthMm: number; heightMm: number }) => ({
  minX: -POSITION_MARGIN_MM,
  maxX: lid.widthMm + POSITION_MARGIN_MM,
  minY: -POSITION_MARGIN_MM,
  maxY: lid.heightMm + POSITION_MARGIN_MM,
});

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

/** Forces one item back inside the limits `parseLayout` accepts, so a save can never become unreadable. */
export function clampItem<T extends Placement>(it: T, lid: { widthMm: number; heightMm: number }): T {
  const r = positionRange(lid);
  return {
    ...it,
    xMm: clamp(it.xMm, r.minX, r.maxX),
    yMm: clamp(it.yMm, r.minY, r.maxY),
    widthMm: clamp(it.widthMm, MIN_SIZE_MM, MAX_SIZE_MM),
    heightMm: clamp(it.heightMm, MIN_SIZE_MM, MAX_SIZE_MM),
    rotationDeg: Number.isFinite(it.rotationDeg) ? ((it.rotationDeg % 360) + 360) % 360 : 0,
  };
}

/**
 * Validates untrusted layout JSON (share links, old localStorage). Returns a clean copy or null.
 * Unknown model/colour ids are left for the caller to resolve against the model config.
 */
export function parseLayout(input: unknown, limits = { maxItems: MAX_ITEMS }): Layout | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (o.version !== 1 || !str(o.modelId, 64) || !str(o.colorId, 64) || !Array.isArray(o.items) || o.items.length > limits.maxItems) return null;
  const items: LayoutItem[] = [];
  // Two items sharing an id would be selected, moved and deleted as one (and collide on the React
  // key), so a crafted or hand-edited link gets its repeats renamed rather than silently merged.
  const seen = new Set<string>();
  for (const raw of o.items) {
    if (!raw || typeof raw !== "object") return null;
    const it = raw as Record<string, unknown>;
    if (
      !str(it.id, 32) ||
      !str(it.assetId, 64) ||
      !num(it.xMm, -500, 1000) ||
      !num(it.yMm, -500, 1000) ||
      !num(it.widthMm, 1, 600) ||
      !num(it.heightMm, 1, 600) ||
      !num(it.rotationDeg, -36000, 36000)
    )
      return null;
    let id = it.id as string;
    if (seen.has(id)) {
      const stem = id.slice(0, 28);
      let n = 2;
      while (seen.has(`${stem}~${n}`)) n++;
      id = `${stem}~${n}`;
    }
    seen.add(id);
    items.push({
      id,
      assetId: it.assetId as string,
      label: typeof it.label === "string" ? it.label.slice(0, 80) : "",
      xMm: it.xMm as number,
      yMm: it.yMm as number,
      widthMm: it.widthMm as number,
      heightMm: it.heightMm as number,
      rotationDeg: it.rotationDeg as number,
      flipX: it.flipX === true,
      locked: it.locked === true,
      finish: FINISHES.includes(it.finish as Finish) ? (it.finish as Finish) : "glossy",
      borderMm: num(it.borderMm, 0, 20) ? (it.borderMm as number) : 0,
    });
  }
  return { version: 1, modelId: o.modelId as string, colorId: o.colorId as string, keepLogoClear: o.keepLogoClear !== false, items };
}

/** Spreadsheet-safe CSV cell: neutralises formula prefixes and quotes the value. */
export function csvCell(value: string | number | boolean) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) || s !== String(value) ? `"${s.replace(/"/g, '""')}"` : s;
}
