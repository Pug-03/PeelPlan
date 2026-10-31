/**
 * Lid lighting: anodised-aluminium falloff, a soft specular hotspot, and a mirror-polished logo.
 * Renderer-agnostic (Konva and SVG both consume it). Light position is in lid-normalised
 * coordinates: (0,0) top-left corner, (1,1) bottom-right; values outside 0..1 sit off the lid.
 */

export type Light = { u: number; v: number };
export type Stop = [offset: number, color: string];
export type Linear = { start: { x: number; y: number }; end: { x: number; y: number }; stops: Stop[] };
export type Radial = { center: { x: number; y: number }; radius: number; stops: Stop[] };

export const DEFAULT_LIGHT: Light = { u: 0.22, v: 0.12 };

/** Direction of the logo's gloss gradient (logo box units). The reflection edge runs perpendicular to it,
 *  and the hover light sweep travels along it so both read as the same light. */
export const GLOSS_AXIS = { start: { x: 3, y: 1 }, end: { x: 21, y: 23 } } as const;
const glossDir = (() => {
  const dx = GLOSS_AXIS.end.x - GLOSS_AXIS.start.x;
  const dy = GLOSS_AXIS.end.y - GLOSS_AXIS.start.y;
  const len = Math.hypot(dx, dy);
  return { x: dx / len, y: dy / len };
})();
export const GLOSS_DIR = glossDir;

/** Blur radii (σ) of the back-lit logo's halo, in logo-box units (the box is 24 wide). */
export const GLOW_WIDE = 4.5;
export const GLOW_NEAR = 1.2;

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
const toHex = (rgb: number[]) =>
  `#${rgb
    .map((c) =>
      Math.round(clamp(c, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** Mix towards white (amt > 0) or black (amt < 0). */
export function shade(hex: string, amt: number) {
  const target = amt >= 0 ? 255 : 0;
  const a = Math.abs(amt);
  return toHex(parseHex(hex).map((c) => c + (target - c) * a));
}

/** Relative luminance (sRGB, 0..1). */
export function luminance(hex: string) {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function lidLighting(
  lidHex: string,
  size: { widthMm: number; heightMm: number },
  light: Light = DEFAULT_LIGHT,
  logoFinish: "mirror-light" | "gloss-black" | "glow" = "gloss-black",
) {
  const { widthMm: w, heightMm: h } = size;
  const dark = luminance(lidHex) < 0.18;
  const lp = { x: light.u * w, y: light.v * h };

  // Studio look of Apple's product shots: lit from above, so the lid falls off top-to-bottom.
  // The axis leans a little with the light so the surface still answers the pointer.
  const lean = (light.u - 0.5) * 0.4;
  const base: Linear = {
    start: { x: w * (0.5 + lean), y: 0 },
    end: { x: w * (0.5 - lean), y: h },
    // Calibrated against apple.com renders (e.g. Midnight top ≈ #5a6270 → bottom ≈ #262a33).
    stops: dark
      ? [
          [0, shade(lidHex, 0.18)],
          [0.42, shade(lidHex, 0.02)],
          [1, shade(lidHex, -0.36)],
        ]
      : [
          [0, shade(lidHex, 0.5)],
          [0.45, shade(lidHex, 0.12)],
          [1, shade(lidHex, -0.16)],
        ],
  };

  // A faint hotspot only; the vertical falloff does the heavy lifting.
  const specular: Radial = {
    center: lp,
    radius: Math.hypot(w, h) * 0.5,
    stops: [
      [0, `rgba(255,255,255,${dark ? 0.07 : 0.16})`],
      [0.4, `rgba(255,255,255,${dark ? 0.02 : 0.05})`],
      [1, "rgba(255,255,255,0)"],
    ],
  };

  // Logo inlay, coordinates in the 24 × 24 logo box.
  // Pro: glossy black with the hard diagonal reflection seen on apple.com (graphite upper-left, black lower-right).
  // Air: pale polished mirror, a lighter, cooler tint of the lid that brightens towards the top.
  const split = clamp(0.5 + (0.5 - light.u) * 0.16 + (0.5 - light.v) * 0.08, 0.35, 0.65);
  const logo: Linear =
    logoFinish === "glow"
      ? // Back-lit (PROLED Pro): the light comes from inside, so it ignores the room light. Near-white, a touch cooler at the foot.
        { start: { x: 12, y: 0 }, end: { x: 12, y: 24 }, stops: [[0, "#ffffff"], [0.6, "#fbfcfd"], [1, "#eef1f5"]] }
      : logoFinish === "gloss-black"
      ? {
          ...GLOSS_AXIS,
          stops: [
            [0, dark ? "#4a4a4e" : "#3d3d40"],
            [clamp(split - 0.001), "#19191a"],
            [split, "#050505"],
            [1, "#000000"],
          ],
        }
      : {
          start: { x: 12 + (light.u - 0.5) * 6, y: 0 },
          end: { x: 12 - (light.u - 0.5) * 6, y: 24 },
          // Midnight Air: soft black inlay. Light colours: a pale, slightly brighter tint of the lid.
          stops: dark
            ? [
                [0, "#222326"],
                [0.6, "#0e0e10"],
                [1, "#060607"],
              ]
            : [
                [0, shade(lidHex, 0.82)],
                [0.55, shade(lidHex, 0.62)],
                [1, shade(lidHex, 0.44)],
              ],
        };

  // Chamfered edge catching the light, as on the renders.
  const rim = dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)";

  return { base, specular, logo, dark, rim };
}

/** Konva wants gradient stops flattened: [offset, color, offset, color, ...]. */
export const flatStops = (stops: Stop[]) => stops.flatMap(([o, c]) => [o, c]);
