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

/** A drawing primitive in device millimetres, shared by the SVG and canvas renderers. */
export type CameraShape =
  | { type: "rect"; x: number; y: number; w: number; h: number; r: number; fill: string; stroke?: string; strokeWidth?: number }
  | { type: "circle"; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number };

/**
 * The camera module drawn in the device's own finish: a footprint a shade darker than the body, a flat
 * top face catching the light, then each opening at the size and place Apple's drawings give it.
 * Lenses are black glass in a metal ring, the flash a pale warm disc, the mic a pinhole.
 */
export function cameraArt(c: CameraGeometry, bodyHex: string): CameraShape[] {
  const dark = luminance(bodyHex) < 0.18;
  const edge = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.28)";
  const out: CameraShape[] = [
    { type: "rect", x: c.x, y: c.y, w: c.width, h: c.height, r: c.radius, fill: shade(bodyHex, dark ? 0.05 : -0.1), stroke: edge, strokeWidth: 0.3 },
  ];
  if (c.plateau) {
    const p = c.plateau;
    out.push({ type: "rect", x: p.xMm, y: p.yMm, w: p.sizeMm, h: p.sizeMm, r: p.radiusMm, fill: shade(bodyHex, dark ? 0.1 : 0.06), stroke: edge, strokeWidth: 0.2 });
  }
  const ring = shade(bodyHex, dark ? 0.2 : -0.3);
  for (const part of c.parts) {
    const { cxMm: cx, cyMm: cy } = part;
    const r = part.diameterMm / 2;
    switch (part.kind) {
      case "lens":
        out.push(
          { type: "circle", cx, cy, r, fill: "#0a0b0d", stroke: ring, strokeWidth: 0.6 },
          { type: "circle", cx, cy, r: r * 0.62, fill: "#151d2c" },
          { type: "circle", cx, cy, r: r * 0.3, fill: "#06080d" },
          { type: "circle", cx: cx - r * 0.28, cy: cy - r * 0.28, r: r * 0.12, fill: "#ffffff", opacity: 0.4 },
        );
        break;
      case "lidar":
        out.push(
          { type: "circle", cx, cy, r, fill: "#101114", stroke: ring, strokeWidth: 0.4 },
          { type: "circle", cx, cy, r: r * 0.55, fill: "#1c1d22" },
          { type: "circle", cx: cx - r * 0.22, cy: cy - r * 0.22, r: r * 0.1, fill: "#ffffff", opacity: 0.25 },
        );
        break;
      case "flash":
        out.push({ type: "circle", cx, cy, r, fill: "#f2ecd9", stroke: "rgba(0,0,0,0.25)", strokeWidth: 0.25 }, { type: "circle", cx, cy, r: r * 0.6, fill: "#e3d7b6" });
        break;
      case "sensor":
        out.push({ type: "circle", cx, cy, r, fill: "#17181c" });
        break;
      case "mic":
        out.push({ type: "circle", cx, cy, r, fill: "#0b0b0d" });
        break;
    }
  }
  return out;
}
