import type { CameraPart } from "@/config/laptops";
import { luminance, shade } from "./lighting";

/** Camera module geometry as lidGeometry() flattens it (mm, from the back's top-left). */
export type CameraGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  plateau?: { xMm: number; yMm: number; sizeMm: number; radiusMm: number };
  parts: CameraPart[];
};

/** Gradient in device millimetres (absolute, not relative to the shape). */
export type CameraPaint =
  | string
  | { kind: "linear"; x1: number; y1: number; x2: number; y2: number; stops: [number, string][] }
  | { kind: "radial"; cx: number; cy: number; r: number; stops: [number, string][] };

/** A drawing primitive in device millimetres, shared by the SVG and canvas renderers. */
export type CameraShape =
  | { type: "rect"; x: number; y: number; w: number; h: number; r: number; fill: CameraPaint; stroke?: string; strokeWidth?: number; opacity?: number; shadow?: boolean }
  | { type: "circle"; cx: number; cy: number; r: number; fill: CameraPaint; stroke?: string; strokeWidth?: number; opacity?: number; shadow?: boolean };

const radial = (cx: number, cy: number, r: number, stops: [number, string][]): CameraPaint => ({ kind: "radial", cx, cy, r, stops });
const linear = (x1: number, y1: number, x2: number, y2: number, stops: [number, string][]): CameraPaint => ({ kind: "linear", x1, y1, x2, y2, stops });

/**
 * The camera module, redrawn from Apple's product renders (colours sampled from them). It is aluminium,
 * not glass: the raised footprint is the body's own anodised finish, a hair lighter on top, with a soft
 * rounded step whose upper-left edge catches the light and whose right and bottom walls read as a thin dark
 * line, and a soft shadow down and to the right.
 * - Wide lens: a thin graphite ring around a large, near-black cover glass; deep inside, a small blue-grey
 *   optic whose pupil carries an iridescent violet-to-cobalt crescent on its upper left. No white glare.
 * - LiDAR: a plain, flush, matte near-black disc with a faint warm tint. No ring, no visible detail.
 * - Flash: a flush, frosted lens, a cool lavender-grey outer band with fine Fresnel rings around a soft
 *   pinkish-white centre.
 * - Light sensor and mic: flat dark dots.
 * - iPad Air: a shallow boss in the body colour (shaded dark upper-left, light lower-right), a bright
 *   polished chamfer, a dark bezel, then the same dark glass and blue pupil.
 * Sizes and places come from Apple's drawings (see config/laptops).
 */
export function cameraArt(c: CameraGeometry, bodyHex: string): CameraShape[] {
  const dark = luminance(bodyHex) < 0.18;
  const { x, y, width: w, height: h } = c;
  const round = c.radius >= Math.min(w, h) / 2 - 0.01;
  const out: CameraShape[] = [];

  if (!round) {
    // iPad Pro: the raised aluminium footprint. Its outer wall: dark on the lower right, lit on the upper left.
    out.push({
      type: "rect",
      x,
      y,
      w,
      h,
      r: c.radius,
      fill: linear(x, y, x + w, y + h, [
        [0, shade(bodyHex, dark ? 0.2 : 0.5)],
        [0.55, shade(bodyHex, dark ? 0.06 : -0.04)],
        [0.85, shade(bodyHex, dark ? -0.3 : -0.25)],
        [1, dark ? "#19181c" : "#707173"],
      ]),
      shadow: true,
    });
    if (c.plateau) {
      const p = c.plateau;
      out.push({
        type: "rect",
        x: p.xMm,
        y: p.yMm,
        w: p.sizeMm,
        h: p.sizeMm,
        r: p.radiusMm,
        // The flat top: the body's finish, a hair lighter, with the faintest falloff away from the light.
        fill: linear(p.xMm, p.yMm, p.xMm + p.sizeMm, p.yMm + p.sizeMm, [
          [0, shade(bodyHex, dark ? 0.15 : 0.3)],
          [1, shade(bodyHex, dark ? 0.08 : 0.05)],
        ]),
      });
    }
  } else {
    // iPad Air: a shallow boss in the body colour, read through its shading.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = w / 2;
    out.push({
      type: "circle",
      cx,
      cy,
      r,
      fill: linear(cx - r, cy - r, cx + r, cy + r, [
        [0, shade(bodyHex, dark ? -0.3 : -0.38)],
        [0.45, shade(bodyHex, dark ? -0.05 : -0.08)],
        [1, shade(bodyHex, dark ? 0.12 : 0.35)],
      ]),
      shadow: true,
    });
    if (c.plateau) {
      const pr = c.plateau.sizeMm / 2;
      out.push(
        // Thin shadow line at the raised ring's foot, then the bright polished chamfer, then a grey ring.
        { type: "circle", cx, cy, r: pr + 0.15, fill: shade(bodyHex, dark ? -0.5 : -0.55) },
        { type: "circle", cx, cy, r: pr, fill: linear(cx - pr, cy - pr, cx + pr, cy + pr, [[0, "#f4f1f6"], [0.5, shade(bodyHex, dark ? 0.35 : 0.25)], [1, "#d6d1d9"]]) },
        { type: "circle", cx, cy, r: pr - 0.35, fill: dark ? "#6d6c70" : "#a9a4ab" },
        { type: "circle", cx, cy, r: pr - 0.5, fill: radial(cx, cy, pr - 0.5, [[0.85, "#161516"], [1, "#595959"]]) },
      );
    }
  }

  for (const part of c.parts) {
    const { cxMm: cx, cyMm: cy } = part;
    const r = part.diameterMm / 2;
    switch (part.kind) {
      case "lens":
        out.push(
          // Graphite ring with a slightly lighter outer lip (the Air's bezel is drawn above, so skip it there).
          ...(round
            ? []
            : ([
                { type: "circle", cx, cy, r, fill: radial(cx, cy, r, [[0.9, "#313131"], [0.97, "#4c4c4c"], [1, "#545454"]]) },
              ] as CameraShape[])),
          // Cover glass: near black, a touch lighter at the rim, a faint lighter arc low on the right.
          { type: "circle", cx, cy, r: round ? r : r * 0.93, fill: radial(cx, cy, r * 0.93, [[0, "#0e0e0e"], [0.75, "#151515"], [1, "#202020"]]) },
          { type: "circle", cx: cx + r * 0.08, cy: cy + r * 0.08, r: r * 0.88, fill: "rgba(0,0,0,0)", stroke: "rgba(60,55,60,0.5)", strokeWidth: r * 0.05 },
          { type: "circle", cx, cy, r: r * 0.86, fill: radial(cx, cy, r * 0.86, [[0, "#0e0e0e"], [1, "#141414"]]) },
          // Inner optic: a dark blue-grey well with a soft dark ring.
          { type: "circle", cx, cy, r: r * 0.38, fill: radial(cx, cy, r * 0.38, [[0, "#1f222c"], [0.7, "#16171e"], [1, "#0d0c0f"]]) },
          // Pupil, with the iridescent crescent on its upper left.
          { type: "circle", cx, cy, r: r * 0.13, fill: radial(cx, cy, r * 0.13, [[0, "#0a1020"], [1, "#131a33"]]) },
          {
            type: "circle",
            cx: cx - r * 0.05,
            cy: cy - r * 0.05,
            r: r * 0.12,
            fill: radial(cx - r * 0.09, cy - r * 0.09, r * 0.14, [
              [0, "rgba(120,170,255,0.95)"],
              [0.35, "rgba(49,103,197,0.85)"],
              [0.65, "rgba(84,89,190,0.55)"],
              [1, "rgba(49,46,128,0)"],
            ]),
          },
          { type: "circle", cx: cx + r * 0.1, cy: cy + r * 0.08, r: r * 0.07, fill: "rgba(30,75,87,0.6)" },
        );
        break;
      case "lidar":
        out.push({ type: "circle", cx, cy, r, fill: radial(cx, cy, r, [[0, "#17120f"], [0.92, "#16110f"], [1, dark ? "#120d0d" : "#2a2422"]]) });
        break;
      case "flash":
        out.push(
          // Frosted cover: a cool lavender-grey band, brighter inward, a soft pinkish-white centre.
          {
            type: "circle",
            cx,
            cy,
            r,
            fill: radial(cx, cy, r, dark
              ? [[0, "#e4dde3"], [0.3, "#c6bfc5"], [0.55, "#9a9dab"], [0.85, "#848895"], [1, "#737683"]]
              : [[0, "#f2ecf2"], [0.3, "#d8d1d8"], [0.55, "#b9bcc8"], [0.85, "#aeb0bc"], [1, "#999ca9"]]),
          },
          // Fine Fresnel rings.
          ...[0.42, 0.56, 0.7, 0.84].map(
            (k): CameraShape => ({ type: "circle", cx, cy, r: r * k, fill: "rgba(0,0,0,0)", stroke: "rgba(255,255,255,0.22)", strokeWidth: 0.07 }),
          ),
          ...[0.49, 0.63, 0.77].map(
            (k): CameraShape => ({ type: "circle", cx, cy, r: r * k, fill: "rgba(0,0,0,0)", stroke: "rgba(70,72,90,0.16)", strokeWidth: 0.06 }),
          ),
        );
        break;
      case "sensor":
        out.push({ type: "circle", cx, cy, r, fill: "#141517" });
        break;
      case "mic":
        out.push({ type: "circle", cx, cy, r, fill: dark ? "#1b1b1b" : round ? "#4c4b4d" : "#242424", stroke: "rgba(0,0,0,0.35)", strokeWidth: 0.08 });
        break;
    }
  }
  return out;
}
