/**
 * Demo-only artwork switch. When on, lids show the manufacturer logo and the sticker library
 * includes character fan art. Both are trademarked/copyrighted and are for private mockups only;
 * keep this off for any public deployment unless the rights have been licensed.
 */
export const DEMO_ASSETS = process.env.NEXT_PUBLIC_DEMO_ASSETS === "true";

/**
 * Apple logo silhouette in a 24 × 24 box. Path data from Simple Icons (CC0); the mark itself is
 * Apple's trademark, hence demo-only. Visible extent ≈ x 2.3–21.7, y 0–24 (aspect ≈ 0.81).
 */
export const LOGO_VIEWBOX = { width: 24, height: 24 } as const;
export const LOGO_PATH =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";

/** Uniform placement of the silhouette for a logo box (mm): height sets scale, width is centred. */
export function logoTransform(logo: { x: number; y: number; height: number }) {
  const s = logo.height / LOGO_VIEWBOX.height;
  return { x: logo.x - (LOGO_VIEWBOX.width * s) / 2, y: logo.y - logo.height / 2, scale: s };
}

/** Logo tint for a given lid colour: slightly mirrored against the anodised surface. */
export function logoFill(lidHex: string) {
  const r = parseInt(lidHex.slice(1, 3), 16);
  return r < 110 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)";
}
