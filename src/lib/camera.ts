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
  | { type: "circle"; cx: number; cy: number; r: number; fill: CameraPaint; stroke?: string; strokeWidth?: number; opacity?: number };

const radial = (cx: number, cy: number, r: number, stops: [number, string][]): CameraPaint => ({ kind: "radial", cx, cy, r, stops });
const linear = (x1: number, y1: number, x2: number, y2: number, stops: [number, string][]): CameraPaint => ({ kind: "linear", x1, y1, x2, y2, stops });

/**
 * The camera module drawn to read like the real part: light falls from the top left (matching the lid
 * lighting), so the raised footprint and its flat top pick up a soft sheen and a bright upper edge.
 * Lenses are layered black glass with a blue-violet coating glint inside a machined metal ring, the LiDAR
 * a smaller dark window, the flash a pale frosted disc with Fresnel rings, the light sensor and mic small
 * dark openings. Sizes and places come from Apple's drawings (see config/laptops).
 */
export function cameraArt(c: CameraGeometry, bodyHex: string): CameraShape[] {
  const dark = luminance(bodyHex) < 0.18;
  const { x, y, width: w, height: h } = c;
  const out: CameraShape[] = [
    // Footprint: the raised base, a touch darker than the body, lit from the top left.
    {
      type: "rect",
      x,
      y,
      w,
      h,
      r: c.radius,
      fill: linear(x, y, x + w, y + h, [
        [0, shade(bodyHex, dark ? 0.1 : 0.12)],
        [0.55, shade(bodyHex, dark ? 0 : -0.08)],
        [1, shade(bodyHex, dark ? -0.35 : -0.22)],
      ]),
      stroke: dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.25)",
      strokeWidth: 0.25,
      shadow: true,
    },
  ];
  if (c.plateau) {
    const p = c.plateau;
    out.push(
      {
        type: "rect",
        x: p.xMm,
        y: p.yMm,
        w: p.sizeMm,
        h: p.sizeMm,
        r: p.radiusMm,
        fill: linear(p.xMm, p.yMm, p.xMm + p.sizeMm, p.yMm + p.sizeMm, [
          [0, shade(bodyHex, dark ? 0.16 : 0.18)],
          [0.5, shade(bodyHex, dark ? 0.04 : 0.02)],
          [1, shade(bodyHex, dark ? -0.15 : -0.1)],
        ]),
        stroke: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)",
        strokeWidth: 0.3,
      },
      // A sheen across the flat top, like glass catching the light.
      {
        type: "rect",
        x: p.xMm,
        y: p.yMm,
        w: p.sizeMm,
        h: p.sizeMm,
        r: p.radiusMm,
        fill: linear(p.xMm, p.yMm, p.xMm + p.sizeMm * 0.7, p.yMm + p.sizeMm * 0.7, [
          [0, "rgba(255,255,255,0.22)"],
          [0.45, "rgba(255,255,255,0.04)"],
          [1, "rgba(255,255,255,0)"],
        ]),
      },
    );
  }

  // Machined ring around an opening: bright top-left rim, dark lower edge.
  const metalRing = (cx: number, cy: number, r: number): CameraShape => ({
    type: "circle",
    cx,
    cy,
    r,
    fill: linear(cx - r, cy - r, cx + r, cy + r, dark
      ? [[0, "#8a8b90"], [0.35, "#3a3b3f"], [0.7, "#1a1b1e"], [1, "#4a4b50"]]
      : [[0, "#f4f4f6"], [0.35, "#b9babe"], [0.7, "#5f6065"], [1, "#c9cacf"]]),
    stroke: "rgba(0,0,0,0.45)",
    strokeWidth: 0.15,
  });

  for (const part of c.parts) {
    const { cxMm: cx, cyMm: cy } = part;
    const r = part.diameterMm / 2;
    switch (part.kind) {
      case "lens":
        out.push(
          metalRing(cx, cy, r),
          // Black barrel.
          { type: "circle", cx, cy, r: r * 0.84, fill: radial(cx, cy, r * 0.84, [[0, "#15161b"], [0.8, "#0a0a0d"], [1, "#000"]]) },
          // Front element: coated glass with a deep blue-violet cast.
          { type: "circle", cx, cy, r: r * 0.62, fill: radial(cx - r * 0.12, cy - r * 0.12, r * 0.7, [[0, "#2b3a63"], [0.45, "#141b30"], [0.8, "#070a12"], [1, "#020305"]]) },
          { type: "circle", cx, cy, r: r * 0.46, fill: "rgba(0,0,0,0)", stroke: "rgba(140,150,255,0.28)", strokeWidth: 0.2 },
          { type: "circle", cx, cy, r: r * 0.22, fill: radial(cx, cy, r * 0.22, [[0, "#000"], [1, "#05060c"]]) },
          // Coating glint and a specular highlight from the top left.
          { type: "circle", cx: cx + r * 0.18, cy: cy + r * 0.2, r: r * 0.2, fill: radial(cx + r * 0.18, cy + r * 0.2, r * 0.2, [[0, "rgba(170,110,255,0.45)"], [1, "rgba(170,110,255,0)"]]) },
          { type: "circle", cx: cx - r * 0.26, cy: cy - r * 0.28, r: r * 0.16, fill: radial(cx - r * 0.26, cy - r * 0.28, r * 0.16, [[0, "rgba(255,255,255,0.85)"], [1, "rgba(255,255,255,0)"]]) },
        );
        break;
      case "lidar":
        out.push(
          metalRing(cx, cy, r),
          { type: "circle", cx, cy, r: r * 0.8, fill: radial(cx - r * 0.15, cy - r * 0.15, r * 0.9, [[0, "#26272d"], [0.6, "#0e0f12"], [1, "#030304"]]) },
          // The emitter and receiver windows behind the glass.
          { type: "circle", cx: cx - r * 0.22, cy, r: r * 0.16, fill: "#1b0f12", stroke: "rgba(255,255,255,0.08)", strokeWidth: 0.1 },
          { type: "circle", cx: cx + r * 0.22, cy, r: r * 0.16, fill: "#0d0f16", stroke: "rgba(255,255,255,0.08)", strokeWidth: 0.1 },
          { type: "circle", cx: cx - r * 0.3, cy: cy - r * 0.34, r: r * 0.14, fill: radial(cx - r * 0.3, cy - r * 0.34, r * 0.14, [[0, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]) },
        );
        break;
      case "flash":
        out.push(
          { type: "circle", cx, cy, r, fill: dark ? "#2a2b2f" : "#d4d5d9", stroke: "rgba(0,0,0,0.3)", strokeWidth: 0.12 },
          { type: "circle", cx, cy, r: r * 0.86, fill: radial(cx - r * 0.2, cy - r * 0.2, r, [[0, "#fffdf5"], [0.6, "#f1e8cc"], [1, "#d9cca5"]]) },
          // Fresnel rings in the frosted cover.
          { type: "circle", cx, cy, r: r * 0.66, fill: "rgba(0,0,0,0)", stroke: "rgba(120,100,60,0.18)", strokeWidth: 0.12 },
          { type: "circle", cx, cy, r: r * 0.46, fill: "rgba(0,0,0,0)", stroke: "rgba(120,100,60,0.18)", strokeWidth: 0.12 },
          { type: "circle", cx, cy, r: r * 0.26, fill: "rgba(0,0,0,0)", stroke: "rgba(120,100,60,0.18)", strokeWidth: 0.12 },
        );
        break;
      case "sensor":
        out.push(
          { type: "circle", cx, cy, r, fill: radial(cx - r * 0.25, cy - r * 0.25, r * 1.1, [[0, "#2a2b30"], [0.6, "#0d0d10"], [1, "#000"]]), stroke: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.35)", strokeWidth: 0.12 },
          { type: "circle", cx: cx - r * 0.3, cy: cy - r * 0.3, r: r * 0.22, fill: "rgba(255,255,255,0.35)" },
        );
        break;
      case "mic":
        out.push({ type: "circle", cx, cy, r, fill: radial(cx, cy, r, [[0, "#000"], [0.7, "#0a0a0b"], [1, dark ? "#2a2a2e" : "#55565b"]]) });
        break;
    }
  }
  return out;
}
