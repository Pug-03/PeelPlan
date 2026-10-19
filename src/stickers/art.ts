/**
 * Drawing helpers shared by the in-house sticker artwork.
 */

export const wrap = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}">${body}</svg>`;

/** Outline colour shared by the in-house artwork (warm near-black, like printed vinyl). */
export const O = "#2B2320";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const BLACK = "Arial Black, Arial, Helvetica, sans-serif";

/**
 * White die-cut margin around `shapes` (plain shapes without their own fill/stroke), with a faint
 * cut line so the sticker still reads on a white or silver lid.
 */
export const die = (shapes: string, w = 12) =>
  `<g fill="#fff" stroke="#000" stroke-opacity=".13" stroke-width="${w + 2}" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>` +
  `<g fill="#fff" stroke="#fff" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>`;

/** Shiny eyes, blush and a small smile, centred on (x, y). */
export const face = (x: number, y: number, gap = 11, s = 1) =>
  `<g fill="#FF8FA3" opacity=".75"><ellipse cx="${x - gap - 6 * s}" cy="${y + 8 * s}" rx="${5 * s}" ry="${3 * s}"/><ellipse cx="${x + gap + 6 * s}" cy="${y + 8 * s}" rx="${5 * s}" ry="${3 * s}"/></g>` +
  `<g fill="${O}"><ellipse cx="${x - gap}" cy="${y}" rx="${3.6 * s}" ry="${4.6 * s}"/><ellipse cx="${x + gap}" cy="${y}" rx="${3.6 * s}" ry="${4.6 * s}"/></g>` +
  `<g fill="#fff"><circle cx="${x - gap + 1.3 * s}" cy="${y - 1.8 * s}" r="${1.5 * s}"/><circle cx="${x + gap + 1.3 * s}" cy="${y - 1.8 * s}" r="${1.5 * s}"/></g>` +
  `<path d="M${x - 4 * s} ${y + 6 * s}q${4 * s} ${4.5 * s} ${8 * s} 0" stroke="${O}" stroke-width="${2.8 * s}" fill="none" stroke-linecap="round"/>`;

/** Gloss highlight stroke. */
export const gloss = (d: string, w = 4) => `<path d="${d}" stroke="#fff" stroke-width="${w}" fill="none" stroke-linecap="round" opacity=".85"/>`;
