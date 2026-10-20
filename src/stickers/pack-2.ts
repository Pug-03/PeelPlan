import { BLACK, MONO, O, die, face, gloss, wrap } from "./art";
import type { LibrarySticker } from "./library";

/**
 * Sticker pack 2: 100 original in-house designs (Thai food & culture, animals, nature, space,
 * retro objects, words and shapes). Same kawaii vinyl style as the starter library: chunky warm
 * outline, flat fill + one shade, gloss highlight, white die-cut border.
 */

/** Artwork units to millimetres (same scale as the code pack). */
const MM_PER_UNIT = 0.36;
const TH = "Anuphan, Sukhumvit Set, Thonburi, Tahoma, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mk = (id: string, en: string, th: string, w: number, h: number, body: string, category: "fun" | "coding" = "fun"): LibrarySticker => ({
  id: `p2-${id}`,
  category,
  name: { en, th },
  widthMm: Math.min(80, Math.max(30, Math.round(w * MM_PER_UNIT))),
  viewBox: [w, h],
  svg: wrap(w, h, body),
});

// ---------------------------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------------------------

const S = 3.5;
const f = (n: number) => +n.toFixed(1);
const st = (sw: number) => (sw ? ` stroke="${O}" stroke-width="${sw}" stroke-linejoin="round"` : "");
/** Outlined path. */
const p = (d: string, fill: string, sw = S) => `<path d="${d}" fill="${fill}"${st(sw)}/>`;
const ci = (cx: number, cy: number, r: number, fill: string, sw = S) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${st(sw)}/>`;
const el = (cx: number, cy: number, rx: number, ry: number, fill: string, sw = S, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${st(sw)}${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""}/>`;
const rc = (x: number, y: number, w: number, h: number, r: number, fill: string, sw = S) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${st(sw)}/>`;
/** Open stroke (round caps). */
const ln = (d: string, color: string = O, sw = 3) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Outlined thick line: dark outline under a coloured core. */
const tube = (d: string, color: string, w: number) => ln(d, O, w + 2 * S) + ln(d, color, w);
/** Plain silhouette paths for `die`. */
const pd = (...ds: string[]) => ds.map((d) => `<path d="${d}"/>`).join("");
/** Stroke-only silhouette part for `die` (e.g. a stalk or steam): width is the full die width. */
const sd = (d: string, w: number) => `<path d="${d}" fill="none" stroke-width="${w}"/>`;
/** Union of overlapping shapes with one shared outline (outline pass, then fill pass). */
const blob = (shapes: string, fill: string, sw = S) =>
  `<g fill="${fill}" stroke="${O}" stroke-width="${sw * 2}" stroke-linejoin="round">${shapes}</g><g fill="${fill}">${shapes}</g>`;
const clip = (id: string, shape: string, inner: string) => `<defs><clipPath id="${id}">${shape}</clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;

// Faces ---------------------------------------------------------------------------------------

const eyes = (x: number, y: number, gap = 11, s = 1) =>
  `<g fill="${O}"><ellipse cx="${x - gap}" cy="${y}" rx="${3.6 * s}" ry="${4.6 * s}"/><ellipse cx="${x + gap}" cy="${y}" rx="${3.6 * s}" ry="${4.6 * s}"/></g>` +
  `<g fill="#fff"><circle cx="${f(x - gap + 1.3 * s)}" cy="${f(y - 1.8 * s)}" r="${f(1.5 * s)}"/><circle cx="${f(x + gap + 1.3 * s)}" cy="${f(y - 1.8 * s)}" r="${f(1.5 * s)}"/></g>`;
const cheeks = (x: number, y: number, gap = 11, s = 1) =>
  `<g fill="#FF8FA3" opacity=".75"><ellipse cx="${f(x - gap - 6 * s)}" cy="${f(y + 8 * s)}" rx="${f(5 * s)}" ry="${f(3 * s)}"/><ellipse cx="${f(x + gap + 6 * s)}" cy="${f(y + 8 * s)}" rx="${f(5 * s)}" ry="${f(3 * s)}"/></g>`;
const smile = (x: number, y: number, s = 1) => ln(`M${f(x - 4 * s)} ${f(y + 6 * s)}q${f(4 * s)} ${f(4.5 * s)} ${f(8 * s)} 0`, O, f(2.8 * s));
/** Open laughing mouth with a tongue. */
const grin = (x: number, y: number, s = 1) =>
  `<path d="M${f(x - 6 * s)} ${f(y + 5 * s)}h${f(12 * s)}a${f(6 * s)} ${f(6 * s)} 0 0 1 ${f(-12 * s)} 0z" fill="${O}" stroke="${O}" stroke-width="${f(1.6 * s)}" stroke-linejoin="round"/>` +
  `<ellipse cx="${x}" cy="${f(y + 9 * s)}" rx="${f(3 * s)}" ry="${f(1.7 * s)}" fill="#FF6F86"/>`;
const happyEyes = (x: number, y: number, gap = 11, s = 1) =>
  ln(
    `M${f(x - gap - 4 * s)} ${f(y + 1.5 * s)}q${f(4 * s)} ${f(-6 * s)} ${f(8 * s)} 0M${f(x + gap - 4 * s)} ${f(y + 1.5 * s)}q${f(4 * s)} ${f(-6 * s)} ${f(8 * s)} 0`,
    O,
    f(2.8 * s),
  );
const sleepyEyes = (x: number, y: number, gap = 11, s = 1) =>
  ln(
    `M${f(x - gap - 4 * s)} ${f(y - 1 * s)}q${f(4 * s)} ${f(5 * s)} ${f(8 * s)} 0M${f(x + gap - 4 * s)} ${f(y - 1 * s)}q${f(4 * s)} ${f(5 * s)} ${f(8 * s)} 0`,
    O,
    f(2.8 * s),
  );
const happy = (x: number, y: number, gap = 11, s = 1) => happyEyes(x, y, gap, s) + cheeks(x, y, gap, s) + grin(x, y, s);
const sleepy = (x: number, y: number, gap = 11, s = 1) => sleepyEyes(x, y, gap, s) + cheeks(x, y, gap, s) + smile(x, y, s);
const wink = (x: number, y: number, gap = 11, s = 1) =>
  ln(`M${f(x - gap - 4 * s)} ${f(y + 1.5 * s)}q${f(4 * s)} ${f(-6 * s)} ${f(8 * s)} 0`, O, f(2.8 * s)) +
  `<ellipse cx="${x + gap}" cy="${y}" rx="${f(3.6 * s)}" ry="${f(4.6 * s)}" fill="${O}"/><circle cx="${f(x + gap + 1.3 * s)}" cy="${f(y - 1.8 * s)}" r="${f(1.5 * s)}" fill="#fff"/>` +
  cheeks(x, y, gap, s) +
  grin(x, y, s);

// Shapes --------------------------------------------------------------------------------------

/** Star polygon with n points (outer radius ro, inner ri). */
const star = (cx: number, cy: number, ro: number, ri: number, n: number, rot = -90) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`);
  }
  return `M${pts.join("L")}Z`;
};
/** Jagged points along an elliptical arc (degrees), alternating rim / rim - depth. */
const spikes = (cx: number, cy: number, rx: number, ry: number, depth: number, n: number, a0 = 0, a1 = 360) => {
  const pts: string[] = [];
  const steps = n * 2;
  const full = a1 - a0 >= 360;
  for (let i = 0; i <= steps - (full ? 1 : 0); i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    const k = i % 2 ? depth : 0;
    pts.push(`${f(cx + (rx - k) * Math.cos(a))} ${f(cy + (ry - k) * Math.sin(a))}`);
  }
  return pts;
};
/** Circle with a wavy rim (frosting, scalloped badges). */
const wavy = (cx: number, cy: number, r: number, amp: number, n: number, steps = 96) => {
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r + amp * Math.sin(n * a);
    pts.push(`${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`);
  }
  return `M${pts.join("L")}Z`;
};
/** Four-point sparkle. */
const spark = (x: number, y: number, r: number) => {
  const k = r * 0.2;
  return `M${x} ${y - r}Q${f(x + k)} ${f(y - k)} ${x + r} ${y}Q${f(x + k)} ${f(y + k)} ${x} ${y + r}Q${f(x - k)} ${f(y + k)} ${x - r} ${y}Q${f(x - k)} ${f(y - k)} ${x} ${y - r}Z`;
};
/** Teardrop, point up, round part centred on (x, y). */
const drop = (x: number, y: number, r: number) =>
  `M${x} ${f(y - r * 1.9)}C${f(x + r * 0.5)} ${f(y - r * 1.2)} ${x + r} ${f(y - r * 0.6)} ${x + r} ${y}A${r} ${r} 0 0 1 ${x - r} ${y}C${x - r} ${f(y - r * 0.6)} ${f(x - r * 0.5)} ${f(y - r * 1.2)} ${x} ${f(y - r * 1.9)}Z`;
/** Simple 5-petal flower. */
const flower = (x: number, y: number, r: number, petal: string, mid = "#FFD23F", sw = 2) =>
  Array.from({ length: 5 }, (_, i) => {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    return ci(f(x + r * Math.cos(a)), f(y + r * Math.sin(a)), r * 0.9, petal, sw);
  }).join("") + ci(x, y, f(r * 0.7), mid, sw);

type TextOpts = { font?: string; tl?: number; stroke?: string; sw?: number; weight?: number; extra?: string };
const text = (x: number, y: number, s: string, size: number, fill: string, o: TextOpts = {}) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="${o.font ?? BLACK}" font-weight="${o.weight ?? 900}" font-size="${size}" fill="${fill}"` +
  (o.tl ? ` textLength="${o.tl}" lengthAdjust="spacingAndGlyphs"` : "") +
  (o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 5}" stroke-linejoin="round" paint-order="stroke"` : "") +
  `${o.extra ?? ""}>${esc(s)}</text>`;

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

/** Sealed bubble-tea cup with a fat straw; `extra` is drawn inside the cup (clipped). */
function boba(tea: string, band: string, straw: string, faceArt: string, extra = "") {
  const cup = "M16 48H74L66 130Q65 136 59 136H31Q25 136 24 130Z";
  const strawRect = `<rect x="47" y="14" width="12" height="40" rx="4" transform="rotate(-8 53 34)"/>`;
  return `${die(pd(cup) + `<rect x="11" y="40" width="68" height="12" rx="6"/>` + strawRect)}
    <g transform="rotate(-8 53 34)">${rc(47, 14, 12, 40, 4, straw, 3)}${ln("M49 24l8-3M49 33l8-3", "#fff", 2.4)}</g>
    ${p(cup, tea)}
    ${clip(
      "c",
      `<path d="${cup}"/>`,
      `<rect x="10" y="50" width="70" height="13" fill="${band}"/>${extra}
       <g fill="#3B2416"><circle cx="33" cy="125" r="5.5"/><circle cx="45" cy="128" r="5.5"/><circle cx="57" cy="124" r="5.5"/><circle cx="39" cy="115" r="5.5"/><circle cx="51" cy="114" r="5.5"/><circle cx="61" cy="113" r="5"/><circle cx="29" cy="113" r="5"/></g>
       <g fill="#fff" opacity=".7"><circle cx="31.5" cy="123" r="1.5"/><circle cx="43.5" cy="126" r="1.5"/><circle cx="55.5" cy="122" r="1.5"/><circle cx="37.5" cy="113" r="1.5"/><circle cx="49.5" cy="112" r="1.5"/></g>`,
    )}
    <path d="${cup}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
    ${rc(11, 40, 68, 12, 6, "#fff")}${ln("M18 45h22", "#DCEAF3", 2.5)}
    ${gloss("M25 68L28 100")}
    ${faceArt}`;
}

/** Rounded word pill with an optional icon on the left; width follows `tl` (text length). */
function pill(label: string, opts: { bg: string; fg: string; font: string; size: number; tl: number; icon?: string; iconW?: number; stroke?: string }) {
  const iconW = opts.icon ? (opts.iconW ?? 44) : 0;
  const w = Math.round(16 + 22 + iconW + opts.tl + 22 + 16);
  const h = 82;
  const shape = `<rect x="16" y="15" width="${w - 32}" height="52" rx="26"/>`;
  const tx = 38 + iconW + opts.tl / 2;
  return {
    w,
    h,
    body: `${die(shape)}
      ${rc(16, 15, w - 32, 52, 26, opts.bg)}
      ${gloss(`M32 27q5-4 14-4`, 3)}
      ${opts.icon ?? ""}
      ${text(tx, 41 + opts.size * 0.36, label, opts.size, opts.fg, { font: opts.font, tl: opts.tl, stroke: opts.stroke, sw: 5 })}`,
  };
}

// ---------------------------------------------------------------------------------------------
// Thai food & drink
// ---------------------------------------------------------------------------------------------

const SOM_BODY = "M24 64H126L117 100Q113 112 99 112H51Q37 112 33 100Z";
const SOM_FILL = "M30 60C34 40 58 32 74 38C90 30 116 38 120 60Z";
const PAD_MOUND = "M30 68C28 46 50 34 80 36C110 34 132 46 130 68C118 78 42 78 30 68Z";
const PAD_LIME = "M118 56L144 46A17 17 0 0 1 136 76Z";
const SHRIMP = "M50 54C44 44 52 32 64 34C74 36 76 46 70 50C66 46 62 44 58 46C54 48 54 52 56 56Z";
const MANGO = "M28 70C22 44 42 24 68 26C92 28 102 50 96 74C90 98 68 106 50 102C36 99 31 86 28 70Z";
const MANGO_LEAF = "M66 32C70 18 86 13 100 17C96 31 82 36 66 32Z";
const CHA_CUP = "M18 36H72L64 126Q63 130 59 130H31Q27 130 26 126Z";
const ROTI_TRAY = "M16 64H134L124 96Q122 102 116 102H34Q28 102 26 96Z";
const DURIAN = `M${spikes(65, 74, 50, 46, 7, 18).join("L")}Z`;
const CHILI = "M34 40C44 36 54 44 64 52C80 64 104 72 130 66C122 82 94 88 70 80C48 72 36 58 34 40Z";
const CHILI_CAP = "M24 32C30 26 40 30 40 38C38 46 30 46 24 42C22 38 22 35 24 32Z";
const BOWL = "M16 62H124C124 92 100 108 70 108C40 108 16 92 16 62Z";
const RICE = "M24 62C24 36 46 24 70 24C94 24 116 36 116 62Z";
const DUMPLING = "M18 84C18 60 40 44 65 44C90 44 112 60 112 84C112 98 92 104 65 104C38 104 18 98 18 84Z";
const DUMPLING_KNOT = "M56 48C54 38 60 32 65 32C70 32 76 38 74 48Z";
const SOUP_BOWL = "M14 62H136C136 94 110 114 75 114C40 114 14 94 14 62Z";
const MANGOSTEEN_LEAVES = [
  "M60 40C48 42 38 36 35 27C46 25 56 30 60 40Z",
  "M60 40C72 42 82 36 85 27C74 25 64 30 60 40Z",
  "M60 42C50 46 44 54 44 60C54 58 60 52 60 42Z",
  "M60 42C70 46 76 54 76 60C66 58 60 52 60 42Z",
];
const MELON = "M14 34H136A61 61 0 0 1 14 34Z";
const KK_LEAF = "M14 66C30 50 120 50 136 66C120 84 30 84 14 66Z";
const BAG = "M24 50C24 44 28 40 34 40H66C72 40 76 44 76 50L82 112C82 124 70 130 50 130C30 130 18 124 18 112Z";
const BAG_NECK = "M34 42L40 24H60L66 42Z";
const KRATIP_LID = "M22 52C22 38 36 30 55 30C74 30 88 38 88 52Z";
const KRATIP_FOOT = "M32 108H78L74 122H36Z";

const food: LibrarySticker[] = [
  mk(
    "som-tam",
    "Som tam",
    "ส้มตำ",
    150,
    130,
    `${die(pd(SOM_BODY, SOM_FILL) + `<rect x="46" y="106" width="58" height="12" rx="5"/><rect x="18" y="56" width="114" height="14" rx="7"/><rect x="-7" y="-27" width="14" height="54" rx="7" transform="translate(102 42) rotate(40)"/>`)}
     ${rc(46, 106, 58, 12, 5, "#B45F3A")}
     ${p(SOM_BODY, "#D7804F")}
     ${ln("M38 100Q75 108 112 100", "#B9643C", 5)}
     ${p(SOM_FILL, "#CFE9A6")}
     ${ln("M44 52l10-7M58 46l13-4M82 42l11 3M96 48l12 1M66 54l10-3", "#8DC46A", 2.6)}
     <path d="M86 58A11 11 0 0 1 108 58Z" fill="#F25C4A" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
     <g fill="#FFE2A8"><circle cx="92" cy="54" r="1.4"/><circle cx="97" cy="51" r="1.4"/><circle cx="102" cy="54" r="1.4"/></g>
     ${p("M40 56q4-14 18-16q-2 8-14 18Z", "#E8392F", 2.5)}
     ${el(70, 50, 3.2, 2.2, "#E9C38E", 1.5)}${el(78, 53, 3.2, 2.2, "#E9C38E", 1.5)}
     <g transform="translate(102 42) rotate(40)">${rc(-7, -27, 14, 54, 7, "#E8B67E")}${ln("M-2.5 -19v12", "#fff", 2.5)}</g>
     ${rc(18, 56, 114, 14, 7, "#E39062")}
     ${gloss("M30 61h26", 3)}
     ${face(75, 84, 12)}`,
  ),
  mk(
    "pad-thai",
    "Pad thai",
    "ผัดไทย",
    160,
    110,
    `${die(`<ellipse cx="80" cy="72" rx="66" ry="26"/>` + pd(PAD_MOUND, PAD_LIME))}
     ${el(80, 72, 66, 26, "#EAF4FA")}
     <ellipse cx="80" cy="70" rx="54" ry="18" fill="#fff" stroke="#CFE3EE" stroke-width="2"/>
     ${p(PAD_LIME, "#9BD85A", 3)}
     ${p("M122 56L141 49A13 13 0 0 1 135 71Z", "#D7F2A8", 0)}
     ${ln("M122 56L139 56M122 56L136 65", "#9BD85A", 1.8)}
     ${p(PAD_MOUND, "#F6C47E")}
     ${ln("M38 62c6-7 13-7 19 0s13 7 19 0 13-7 19 0 13 7 19 0 13-7 19 0", "#E3A04F", 2.6)}
     ${ln("M48 48c5-5 11-5 16 0s11 5 16 0 11-5 16 0 11 5 16 0", "#E3A04F", 2.6)}
     <g transform="translate(-10 -6)">${p(SHRIMP, "#FF8A5B", 2.8)}${ln("M58 38l2 5M66 37l-1 6", "#FFD0BC", 2)}</g>
     <g transform="translate(170 -6) scale(-1 1)">${p(SHRIMP, "#FF8A5B", 2.8)}${ln("M58 38l2 5M66 37l-1 6", "#FFD0BC", 2)}</g>
     <g fill="#5DBB63"><rect x="56" y="66" width="5" height="3" rx="1"/><rect x="98" y="64" width="5" height="3" rx="1"/><rect x="74" y="70" width="5" height="3" rx="1"/><rect x="112" y="60" width="4" height="3" rx="1"/></g>
     <g fill="#C98B4B"><circle cx="66" cy="68" r="1.6"/><circle cx="90" cy="70" r="1.6"/><circle cx="104" cy="68" r="1.6"/><circle cx="48" cy="62" r="1.6"/></g>
     ${face(80, 56, 11, 0.95)}`,
  ),
  mk(
    "mango",
    "Ripe mango",
    "มะม่วงสุก",
    120,
    120,
    `${die(pd(MANGO, MANGO_LEAF))}
     ${p(MANGO_LEAF, "#5DBB63", 3)}${ln("M70 30Q84 22 96 19", "#3F9A4B", 2)}
     ${p(MANGO, "#FFC53D")}
     ${clip("c", `<path d="${MANGO}"/>`, `<ellipse cx="84" cy="48" rx="16" ry="12" fill="#FF7F50" opacity=".45"/><path d="M98 50C96 82 78 104 44 106L110 116Z" fill="#F5A524"/>`)}
     ${ln("M68 30q0-4-2-6", O, 3)}
     ${gloss("M38 54q3-13 14-18")}
     ${face(60, 68, 11)}`,
  ),
  mk(
    "coconut",
    "Young coconut",
    "มะพร้าวอ่อน",
    110,
    136,
    `${die(`<circle cx="55" cy="84" r="38"/><rect x="-5" y="-22" width="10" height="44" rx="4" transform="translate(66 38) rotate(20)"/>`)}
     ${ci(55, 84, 38, "#86C96A")}
     ${ln("M28 102Q55 124 82 102", "#64AD52", 6)}
     ${el(55, 54, 22, 7, "#FFF8E6", 3)}${el(55, 54, 14, 4, "#F1E6C8", 0)}
     <g transform="translate(66 38) rotate(20)">${rc(-5, -22, 10, 44, 4, "#FF8FB1", 3)}${ln("M-5 -12l10-4M-5 0l10-4", "#fff", 2.4)}</g>
     ${flower(80, 70, 5, "#FF6B8B")}
     ${gloss("M27 80q1-9 6-15")}
     ${face(55, 92, 12)}`,
  ),
  mk(
    "cha-yen",
    "Thai iced tea",
    "ชาเย็น",
    90,
    140,
    `${die(pd(CHA_CUP) + `<rect x="13" y="30" width="64" height="10" rx="5"/><rect x="50" y="12" width="9" height="30" rx="3" transform="rotate(8 54 27)"/>`)}
     <g transform="rotate(8 54 27)">${rc(50, 12, 9, 30, 3, "#E8453C", 3)}${ln("M51 20l7-2M51 28l7-2", "#fff", 2.4)}</g>
     ${p(CHA_CUP, "#F38B2A")}
     ${clip(
       "c",
       `<path d="${CHA_CUP}"/>`,
       `<path d="M10 30H80V56Q70 64 60 57Q50 50 40 57Q30 64 20 57Q14 54 10 56Z" fill="#FCE7C8"/>
        <g fill="#fff" opacity=".55"><rect x="25" y="64" width="13" height="12" rx="3" transform="rotate(-12 31 70)"/><rect x="47" y="68" width="13" height="12" rx="3" transform="rotate(14 53 74)"/></g>`,
     )}
     <path d="${CHA_CUP}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${rc(13, 30, 64, 10, 5, "#fff")}
     ${gloss("M26 84L29 108")}
     ${face(45, 96, 9, 0.95)}`,
  ),
  mk(
    "roti",
    "Banana roti",
    "โรตีกล้วย",
    150,
    112,
    `${die(
      pd(ROTI_TRAY) +
        [
          [46, 58, -12],
          [75, 50, 8],
          [104, 58, -6],
        ]
          .map(([x, y, r]) => `<rect x="-17" y="-17" width="34" height="34" rx="5" transform="translate(${x} ${y}) rotate(${r})"/>`)
          .join(""),
    )}
     ${[
       [46, 58, -12],
       [104, 58, -6],
       [75, 50, 8],
     ]
       .map(
         ([x, y, r]) =>
           `<g transform="translate(${x} ${y}) rotate(${r})">${rc(-17, -17, 34, 34, 5, "#F2C26B", 3)}<g fill="#D9963F"><circle cx="-8" cy="-6" r="2.4"/><circle cx="7" cy="5" r="3"/><circle cx="-3" cy="9" r="1.8"/></g>${ci(-2, -2, 5.5, "#FFF3C4", 2)}${ci(8, -8, 4.5, "#FFF3C4", 2)}</g>`,
       )
       .join("")}
     ${ln("M30 46l8 6 8-7 8 7 8-7 8 7 8-7 8 7 8-7 8 7 8-6 8 5", "#fff", 3.2)}
     ${ln("M34 56l8-5 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 5", "#7A4A2E", 2.4)}
     ${p(ROTI_TRAY, "#fff")}
     ${ln("M24 74H126", "#E8453C", 3)}
     ${face(75, 84, 11, 0.9)}`,
  ),
  mk(
    "durian",
    "Durian",
    "ทุเรียน",
    130,
    132,
    `${die(pd(DURIAN) + `<rect x="61" y="16" width="8" height="18" rx="3"/>`)}
     ${rc(61, 16, 8, 18, 3, "#7A5230", 3)}
     ${p(DURIAN, "#BFD04A")}
     ${ln("M32 98Q65 124 98 98", "#A5B83C", 6)}
     ${ln(
       [
         [40, 54],
         [65, 46],
         [90, 54],
         [34, 80],
         [96, 80],
         [46, 104],
         [84, 104],
       ]
         .map(([x, y]) => `M${x - 4} ${y + 2}l4-5 4 5`)
         .join(""),
       "#8FA22E",
       2.4,
     )}
     ${gloss("M34 62q4-12 14-17")}
     ${face(65, 78, 12)}`,
  ),
  mk(
    "chili",
    "Bird's eye chili",
    "พริกขี้หนู",
    150,
    100,
    `${die(pd(CHILI, CHILI_CAP) + sd("M28 32C27 26 30 21 36 19", 18))}
     ${tube("M28 32C27 26 30 21 36 19", "#4CAF50", 3)}
     ${p(CHILI, "#E8392F")}
     ${ln("M46 62C62 78 94 84 120 74", "#C42A22", 5)}
     ${gloss("M44 45Q54 49 62 57", 3.5)}
     ${p(CHILI_CAP, "#4CAF50", 3)}
     ${face(80, 66, 9, 0.8)}`,
  ),
  mk(
    "rice-bowl",
    "Jasmine rice bowl",
    "ข้าวสวยร้อนๆ",
    140,
    126,
    `${die(pd(BOWL, RICE) + `<rect x="50" y="104" width="40" height="10" rx="4"/><rect x="-3" y="-30" width="6" height="60" rx="3" transform="translate(100 40) rotate(55)"/><rect x="-3" y="-30" width="6" height="60" rx="3" transform="translate(98 44) rotate(64)"/>`)}
     <g transform="translate(100 40) rotate(55)">${rc(-3, -30, 6, 60, 3, "#C98F46", 2.5)}</g>
     <g transform="translate(98 44) rotate(64)">${rc(-3, -30, 6, 60, 3, "#E0A95E", 2.5)}</g>
     ${p(RICE, "#FFFDF6")}
     <g fill="#EADFC8">${[
       [40, 50, -30],
       [56, 34, 20],
       [88, 36, -15],
       [100, 52, 35],
       [48, 58, 10],
       [94, 58, -20],
       [72, 30, 0],
     ]
       .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.8" ry="1.4" transform="rotate(${r} ${x} ${y})"/>`)
       .join("")}</g>
     ${rc(50, 104, 40, 10, 4, "#DCE8F5")}
     ${p(BOWL, "#fff")}
     ${ln("M22 74Q70 86 118 74", "#4C8DFF", 4)}
     <g fill="#4C8DFF"><circle cx="40" cy="88" r="2.4"/><circle cx="70" cy="94" r="2.4"/><circle cx="100" cy="88" r="2.4"/></g>
     ${gloss("M34 44q4-10 14-14")}
     ${face(70, 46, 11)}`,
  ),
  mk(
    "dumpling",
    "Steamed dumpling",
    "ขนมจีบ",
    130,
    116,
    `${die(pd(DUMPLING, DUMPLING_KNOT) + `<circle cx="65" cy="30" r="4"/>` + sd("M40 36c-4-6 4-10 0-16M90 36c-4-6 4-10 0-16", 16))}
     ${ln("M40 36c-4-6 4-10 0-16M90 36c-4-6 4-10 0-16", "#B9D7E8", 3.5)}
     ${p(DUMPLING, "#FFF4E2")}
     ${ln("M26 92Q65 108 104 92", "#F0D9B8", 6)}
     ${ln("M65 48L58 62M65 48L72 62M60 48L44 58M70 48L86 58", "#E9D3B4", 2.5)}
     ${p(DUMPLING_KNOT, "#FFF4E2")}
     ${ci(65, 30, 4, "#FF8A3D", 2.5)}
     ${gloss("M30 70q4-10 13-14")}
     ${face(65, 78, 12)}`,
  ),
  mk(
    "tom-yum",
    "Tom yum",
    "ต้มยำกุ้ง",
    150,
    130,
    `${die(pd(SOUP_BOWL) + `<rect x="52" y="108" width="46" height="12" rx="4"/><ellipse cx="75" cy="62" rx="61" ry="14"/>` + sd("M52 44c-5-6 5-10 0-18M75 40c-5-6 5-10 0-18M98 44c-5-6 5-10 0-18", 16))}
     ${ln("M52 44c-5-6 5-10 0-18M75 40c-5-6 5-10 0-18M98 44c-5-6 5-10 0-18", "#F7B08A", 3.5)}
     ${rc(52, 108, 46, 12, 4, "#9CCFB4")}
     ${p(SOUP_BOWL, "#C8EBD7")}
     ${ln("M22 80Q75 100 128 80", "#A6D8BD", 5)}
     ${el(75, 62, 61, 14, "#F06A32")}${el(75, 61, 50, 8, "#F7894E", 0)}
     <g transform="translate(50 56) rotate(-30)">${rc(-3, -12, 6, 24, 2, "#D2E58A", 2.5)}</g>
     ${p("M28 62C32 54 44 52 50 57C44 64 34 66 28 62Z", "#4CAF50", 2.5)}
     ${p("M84 60C80 50 88 42 98 44C106 46 108 54 102 58C99 54 95 52 92 54C88 56 88 59 90 62Z", "#FF9466", 2.5)}
     ${ci(66, 64, 4, "#E8392F", 2)}${ci(66, 64, 1.5, "#FFD1C2", 0)}
     ${p("M108 64a8 6 0 0 1 16 0z", "#F3E3C6", 2.5)}
     ${gloss("M26 76q6 14 16 20")}
     ${face(75, 88, 12)}`,
  ),
  mk(
    "mangosteen",
    "Mangosteen",
    "มังคุด",
    120,
    126,
    `${die(`<circle cx="60" cy="76" r="40"/><rect x="57" y="14" width="6" height="14" rx="3"/>` + pd(...MANGOSTEEN_LEAVES))}
     ${rc(57, 14, 6, 14, 3, "#6B4A2B", 2.5)}
     ${ci(60, 76, 40, "#A24C93")}
     ${ln("M30 98Q60 124 92 98", "#7E3573", 6)}
     ${MANGOSTEEN_LEAVES.map((d) => p(d, "#6FAE4E", 3)).join("")}
     ${gloss("M30 70q3-12 13-18")}
     ${face(60, 84, 12)}`,
  ),
  mk(
    "watermelon",
    "Watermelon slice",
    "แตงโมฝาน",
    150,
    108,
    `${die(pd(MELON))}
     ${p(MELON, "#5DBB63")}
     ${p("M22 34H128A53 53 0 0 1 22 34Z", "#F4FBEF", 0)}
     ${p("M28 34H122A47 47 0 0 1 28 34Z", "#FF5D6C", 0)}
     ${ln("M30 40H120", "#FF8590", 3)}
     ${[
       [46, 52],
       [104, 52],
       [60, 70],
       [90, 70],
       [75, 74],
     ]
       .map(([x, y]) => `<path d="${drop(x, y, 2.2)}" fill="${O}" transform="rotate(180 ${x} ${y})"/>`)
       .join("")}
     <path d="${MELON}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${face(75, 50, 12)}`,
  ),
  mk(
    "moo-ping",
    "Grilled pork skewer",
    "หมูปิ้ง",
    170,
    104,
    `<g transform="rotate(-12 85 52)">
       ${die(`<rect x="14" y="48" width="142" height="8" rx="4"/>` + [52, 85, 118].map((x) => `<rect x="${x - 17}" y="35" width="34" height="34" rx="13"/>`).join(""))}
       ${rc(14, 48, 142, 8, 4, "#E3B47A", 3)}
       ${[52, 85, 118].map((x) => `${rc(x - 17, 35, 34, 34, 13, "#B5652F")}${ln(`M${x - 9} 44l6-4M${x + 2} 58l7-5M${x - 10} 60l5-3`, "#7A3E1C", 2.6)}${gloss(`M${x - 11} 46q2-5 7-7`, 2.5)}`).join("")}
     </g>
     ${happy(85, 49, 7, 0.75)}`,
  ),
  mk(
    "khanom-krok",
    "Coconut pancakes",
    "ขนมครก",
    150,
    100,
    `${die(pd(KK_LEAF) + `<circle cx="46" cy="60" r="17"/><circle cx="75" cy="52" r="17"/><circle cx="104" cy="60" r="17"/>`)}
     ${p(KK_LEAF, "#6CBF5B")}${ln("M22 66H128", "#4FA34F", 2.5)}
     ${[
       [46, 60],
       [104, 60],
       [75, 52],
     ]
       .map(
         ([x, y]) =>
           `${ci(x, y, 17, "#EFA94A")}${ci(x, y, 11.5, "#FFF6DE", 2.5)}<g fill="#5DBB63"><rect x="${x - 6}" y="${y - 5}" width="4" height="2.4" rx="1"/><rect x="${x + 3}" y="${y - 3}" width="4" height="2.4" rx="1"/></g>`,
       )
       .join("")}
     ${happy(75, 52, 5, 0.6)}`,
  ),
  mk("boba-taro", "Taro bubble tea", "ชานมเผือกไข่มุก", 90, 146, boba("#C3A6E6", "#E3D3F7", "#8B7CF6", face(45, 88, 9, 0.95))),
  mk("boba-matcha", "Matcha bubble tea", "ชาเขียวไข่มุก", 90, 146, boba("#A8D47A", "#E4F2D2", "#5DBB63", happy(45, 86, 9, 0.95))),
  mk(
    "boba-brown-sugar",
    "Brown sugar boba",
    "ชานมบราวน์ชูการ์",
    90,
    146,
    boba("#F4E6D4", "#FFF6EA", "#FFB627", wink(45, 86, 9, 0.95), ln("M18 66Q30 78 22 94Q16 108 28 126M72 66Q60 80 68 96Q74 110 62 128", "#A8673A", 5)),
  ),
  mk(
    "iced-coffee-bag",
    "Iced coffee bag",
    "กาแฟเย็นใส่ถุง",
    100,
    140,
    `${die(pd(BAG, BAG_NECK) + `<rect x="52" y="14" width="8" height="30" rx="3" transform="rotate(12 56 29)"/><rect x="32" y="36" width="36" height="8" rx="4"/>` + sd("M42 26C36 12 64 12 58 26", 16))}
     ${tube("M42 26C36 12 64 12 58 26", "#FF6B8B", 2.5)}
     <g transform="rotate(12 56 29)">${rc(52, 14, 8, 30, 3, "#4C8DFF", 3)}</g>
     ${p(BAG_NECK, "#EAF4F8", 3)}
     ${p(BAG, "#EAF4F8")}
     ${clip(
       "c",
       `<path d="${BAG}"/>`,
       `<path d="M10 62Q30 54 50 62T90 62V140H10Z" fill="#A0673F"/><path d="M10 62Q30 54 50 62T90 62V72Q70 80 50 72T10 72Z" fill="#D9B48C"/>
        <g fill="#fff" opacity=".5"><rect x="28" y="78" width="12" height="11" rx="3" transform="rotate(-10 34 83)"/><rect x="58" y="82" width="12" height="11" rx="3" transform="rotate(16 64 87)"/></g>`,
     )}
     <path d="${BAG}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${rc(32, 36, 36, 8, 4, "#FF6B8B", 3)}
     ${gloss("M27 56L25 100")}
     ${face(50, 100, 10, 0.95)}`,
  ),
  mk(
    "sticky-rice-basket",
    "Sticky rice basket",
    "กระติ๊บข้าวเหนียว",
    110,
    134,
    `${die(pd(KRATIP_LID, KRATIP_FOOT) + `<rect x="26" y="50" width="58" height="62" rx="12"/>` + sd("M28 58C12 44 30 16 55 18C80 16 98 44 82 58", 16))}
     ${tube("M28 58C12 44 30 16 55 18C80 16 98 44 82 58", "#8C5A2B", 3)}
     ${p(KRATIP_FOOT, "#C98F46")}
     ${rc(26, 50, 58, 62, 12, "#E1B169")}
     ${clip("c", `<rect x="26" y="50" width="58" height="62" rx="12"/>`, ln(Array.from({ length: 9 }, (_, i) => `M${18 + i * 10} 48l-16 70M${18 + i * 10} 48l16 70`).join(""), "#C99A52", 2))}
     <rect x="26" y="50" width="58" height="62" rx="12" fill="none" stroke="${O}" stroke-width="${S}"/>
     ${p(KRATIP_LID, "#C98F46")}
     ${ln("M30 44Q55 36 80 44", "#A8712F", 3)}
     ${gloss("M33 64v24", 3.5)}
     ${face(55, 84, 11)}`,
  ),
];

// ---------------------------------------------------------------------------------------------
// Thai culture & places
// ---------------------------------------------------------------------------------------------

const TT_CANOPY = "M42 30Q44 18 56 18H154Q164 18 164 28V36H42Z";
const TT_WIND = "M28 64L46 36H66V64Z";
const TT_BODY = "M14 98V76Q14 64 28 64H166V98Q166 102 162 102H18Q14 102 14 98Z";
const HULL = "M16 34Q26 58 54 72H148Q162 70 168 58L170 52H54Q36 50 16 34Z";
const WATER = "M20 74Q30 68 40 74T60 74T80 74T100 74T120 74T140 74T160 74T180 74V88Q180 94 174 94H26Q20 94 20 88Z";
const ELE_BODY =
  "M26 98C22 72 38 54 64 54C86 54 100 62 106 76L108 108Q108 112 104 112H94Q90 112 90 108V100H58V108Q58 112 54 112H44Q40 112 40 108V102C32 102 26 100 26 98Z";
const ELE_TRUNK = "M122 76C136 70 140 54 134 38";
const ELE_DROPS = [drop(122, 26, 4), drop(142, 24, 4.5), drop(154, 40, 3.5)];
const ELE_HEAD_TRUNK = "M80 80C80 98 82 108 92 110C98 110 100 104 96 100";
const LOTUS = {
  outer: ["M70 92C46 92 22 80 16 58C34 56 56 66 70 92Z", "M70 92C94 92 118 80 124 58C106 56 84 66 70 92Z"],
  mid: ["M70 92C50 84 38 62 44 38C60 46 70 66 70 92Z", "M70 92C90 84 102 62 96 38C80 46 70 66 70 92Z"],
  centre: "M70 92C56 78 54 44 70 22C86 44 84 78 70 92Z",
};
const T_BACK = "M18 98L45 70H135L162 98Z";
const T_GABLE = "M90 22L138 76H42Z";
const T_HOOKS = "M22 96C16 92 16 86 20 84M158 96C164 92 164 86 160 84M42 76C36 76 34 70 38 66M138 76C144 76 146 70 142 66M90 22C90 14 97 12 100 17";
const WG_BODY = "M30 44Q30 34 40 34H124Q132 34 132 42V58Q132 64 126 64H76L68 96Q66 102 60 102H48Q42 102 44 96L50 64H40Q30 64 30 54Z";
const LANTERN = "M55 14C80 14 92 36 92 64C92 88 82 104 72 110H38C28 104 18 88 18 64C18 36 30 14 55 14Z";
const KT_SIDE = "M19 84V92Q19 104 75 104Q131 104 131 92V84Z";
const KT_FOLDS = "M24 84L30 64L40 82L48 60L58 80L66 58L75 80L84 58L92 80L102 60L110 82L120 64L126 84Z";
const UMB = `M18 70A52 52 0 0 1 122 70${"a8.67 6 0 0 1 -17.33 0".repeat(6)}Z`;
const UMB_CUSPS = [0, 1, 2, 3, 4, 5, 6].map((k) => f(18 + k * 17.33));

const culture: LibrarySticker[] = [
  mk(
    "tuk-tuk",
    "Tuk-tuk",
    "รถตุ๊กตุ๊ก",
    180,
    126,
    `${die(pd(TT_CANOPY, TT_WIND, TT_BODY) + `<rect x="66" y="32" width="96" height="34"/><circle cx="44" cy="102" r="14"/><circle cx="140" cy="102" r="14"/>`)}
     ${rc(72, 34, 84, 32, 0, "#4A3B6B", 0)}
     ${rc(88, 46, 56, 14, 6, "#E8453C", 3)}
     ${rc(68, 32, 7, 34, 2, "#2E86DE", 3)}${rc(152, 32, 7, 34, 2, "#2E86DE", 3)}
     ${p(TT_WIND, "#CFEBFA")}${gloss("M40 56l10-14", 3)}
     ${p(TT_CANOPY, "#2E86DE")}
     <path d="M44 36${"q4.3 6 8.6 0".repeat(14)}" fill="#FFD23F" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
     ${gloss("M58 25h46", 3)}
     ${p(TT_BODY, "#FFC93C")}
     ${ln("M18 92H162", "#E8453C", 4)}
     ${ci(22, 74, 5, "#FFF6B0", 2.5)}
     ${[44, 140].map((x) => ci(x, 102, 14, "#3A3340") + ci(x, 102, 6, "#D9DEE6", 2.5)).join("")}
     ${face(52, 78, 9, 0.8)}`,
  ),
  mk(
    "longtail-boat",
    "Longtail boat",
    "เรือหางยาว",
    200,
    108,
    `${die(pd(HULL, WATER) + `<rect x="72" y="34" width="64" height="18"/><rect x="150" y="38" width="18" height="14" rx="4"/>` + sd("M166 50L182 80", 20))}
     ${ln("M80 42v12M128 42v12", O, 3)}
     ${rc(72, 34, 64, 8, 4, "#E8453C", 3)}
     ${tube("M166 50L182 80", "#8E9AAF", 3)}${el(183, 83, 3, 6, "#8E9AAF", 2.5, -28)}
     ${rc(150, 38, 18, 14, 4, "#8E9AAF", 3)}
     ${tube("M20 38l-3 12", "#FF6B8B", 3)}${tube("M24 41l0 12", "#FFD23F", 3)}${tube("M28 44l3 11", "#7AE582", 3)}
     ${p(HULL, "#B5713F")}
     ${ln("M58 56H164", "#F6C443", 3)}${ln("M24 44Q36 54 54 56", "#F6C443", 3)}
     ${p(WATER, "#4FB3E8")}
     ${ln("M32 84h20M92 86h24M146 84h16", "#fff", 3)}
     ${face(104, 59, 8, 0.7)}`,
  ),
  mk(
    "elephant-splash",
    "Splashing elephant",
    "ช้างพ่นน้ำ",
    170,
    130,
    `${die(pd(ELE_BODY, ...ELE_DROPS) + `<circle cx="102" cy="66" r="26"/>` + sd(ELE_TRUNK, 26) + sd("M27 86q-10 2-12 10", 14))}
     ${ln("M27 86q-10 2-12 10", O, 3)}
     ${tube(ELE_TRUNK, "#F4B6C2", 8)}
     ${p(ELE_BODY, "#F4B6C2")}
     ${ci(102, 66, 26, "#F4B6C2")}
     ${ln(ELE_TRUNK, "#F4B6C2", 8)}
     ${p("M96 50C80 48 74 64 80 76C86 84 98 80 100 70Z", "#FFD3DC", 3)}
     <g fill="#fff"><ellipse cx="49" cy="110" rx="4" ry="1.8"/><ellipse cx="99" cy="110" rx="4" ry="1.8"/></g>
     ${ELE_DROPS.map((d) => p(d, "#7FD0F5", 2.5)).join("")}
     ${gloss("M38 70q10-10 22-11")}
     <ellipse cx="117" cy="73" rx="5" ry="3" fill="#FF8FA3" opacity=".75"/>
     ${el(110, 61, 3.6, 4.6, O, 0)}${ci(111.3, 59.2, 1.5, "#fff", 0)}`,
  ),
  mk(
    "elephant-head",
    "Festive elephant",
    "ช้างทรงเครื่อง",
    160,
    130,
    `${die(`<ellipse cx="42" cy="64" rx="24" ry="30"/><ellipse cx="118" cy="64" rx="24" ry="30"/><ellipse cx="80" cy="60" rx="32" ry="30"/>` + sd(ELE_HEAD_TRUNK, 28))}
     ${el(42, 64, 24, 30, "#93A6C2")}${el(118, 64, 24, 30, "#93A6C2")}
     ${el(45, 66, 13, 19, "#F2B8C6", 0)}${el(115, 66, 13, 19, "#F2B8C6", 0)}
     ${tube(ELE_HEAD_TRUNK, "#A3B5CF", 12)}
     ${el(80, 60, 32, 30, "#A3B5CF")}
     ${ln(ELE_HEAD_TRUNK, "#A3B5CF", 12)}
     ${p("M64 84q-6 10 0 16q2-8 6-12Z", "#FFF8EC", 2.5)}${p("M96 84q6 10 0 16q-2-8-6-12Z", "#FFF8EC", 2.5)}
     ${p("M58 34Q80 24 102 34L98 50Q80 58 62 50Z", "#E8453C", 3)}
     ${ln("M62 47Q80 55 98 47", "#F6C443", 3)}
     <g fill="#F6C443"><circle cx="68" cy="38" r="2"/><circle cx="80" cy="35" r="2"/><circle cx="92" cy="38" r="2"/></g>
     ${p("M80 50l6 7-6 7-6-7Z", "#F6C443", 2.5)}
     ${eyes(80, 70, 15, 0.9)}${cheeks(80, 70, 15, 0.9)}
     ${gloss("M56 46q3-8 9-11", 3)}`,
  ),
  mk(
    "lotus",
    "Lotus",
    "ดอกบัว",
    140,
    116,
    `${die(pd(...LOTUS.outer, ...LOTUS.mid, LOTUS.centre) + `<ellipse cx="70" cy="96" rx="46" ry="9"/>`)}
     ${el(70, 96, 46, 9, "#5DBB63")}${ln("M40 96h60", "#4FA34F", 2.5)}
     ${LOTUS.outer.map((d) => p(d, "#F48FB1")).join("")}
     ${LOTUS.mid.map((d) => p(d, "#F7A8C4")).join("")}
     ${p(LOTUS.centre, "#FFC2D9")}
     ${ln("M70 30q-6 10-6 24M46 46q4 10 10 20M94 46q-4 10-10 20", "#F48FB1", 2.5)}
     ${gloss("M64 40q2-6 5-10", 3)}
     ${face(70, 68, 8, 0.8)}`,
  ),
  mk(
    "temple-roof",
    "Temple gable",
    "หน้าบันวัด",
    180,
    124,
    `${die(pd(T_BACK, T_GABLE) + `<rect x="46" y="94" width="88" height="18" rx="2"/>` + sd(T_HOOKS, 16))}
     ${tube(T_HOOKS, "#F6C443", 3.5)}
     ${p(T_BACK, "#2F8F63")}${ln("M32 88H148M42 79H138", "#257552", 2.5)}
     ${rc(46, 94, 88, 18, 2, "#FFF4DC")}
     ${ln("M60 96v14M120 96v14", O, 2.5)}
     ${p("M80 112V102Q90 94 100 102V112Z", "#E0A526", 2.5)}
     ${p(T_GABLE, "#F6C443")}
     ${p("M90 36L124 72H56Z", "#C8372D", 2.5)}
     ${p("M90 46l8 10-8 10-8-10Z", "#F6C443", 2)}${ci(90, 56, 2.5, "#C8372D", 0)}
     <g fill="#F6C443"><circle cx="72" cy="66" r="2"/><circle cx="108" cy="66" r="2"/></g>`,
  ),
  mk(
    "water-gun",
    "Songkran water gun",
    "ปืนฉีดน้ำสงกรานต์",
    176,
    116,
    `${die(pd(WG_BODY) + `<rect x="62" y="14" width="46" height="22" rx="9"/><rect x="130" y="42" width="16" height="12" rx="3"/><rect x="84" y="62" width="44" height="11" rx="5.5"/><circle cx="154" cy="48" r="4.5"/><circle cx="162" cy="40" r="3"/><circle cx="162" cy="56" r="3"/>`)}
     ${rc(62, 14, 46, 22, 9, "#BDEBFB")}
     ${p("M64.5 26Q75 22 85 26T105.5 26V27Q105.5 33.5 99 33.5H71Q64.5 33.5 64.5 27Z", "#4FB3E8", 0)}
     ${gloss("M70 20h10", 2.5)}
     ${rc(78, 30, 14, 8, 2, "#FFD23F", 2.5)}
     ${p(WG_BODY, "#FF8A3D")}
     ${ln("M36 58H126", "#E8692A", 4)}
     ${rc(130, 42, 16, 12, 3, "#FFD23F", 3)}
     ${rc(84, 62, 44, 11, 5.5, "#FFD23F", 3)}
     ${ci(154, 48, 4.5, "#7FD0F5", 2.5)}${ci(162, 40, 3, "#7FD0F5", 2)}${ci(162, 56, 3, "#7FD0F5", 2)}
     ${gloss("M40 40h20", 3)}
     ${face(96, 46, 9, 0.8)}`,
  ),
  mk(
    "sky-lantern",
    "Sky lantern",
    "โคมลอย",
    110,
    150,
    `${die(pd(LANTERN, spark(22, 30, 7), spark(92, 124, 6)) + `<rect x="36" y="108" width="38" height="7" rx="3.5"/><circle cx="55" cy="128" r="12"/>`)}
     ${ci(55, 128, 12, "#FFE9A8", 0)}
     ${p(drop(55, 130, 6), "#FF9F1C", 2.5)}${p(drop(55, 131.5, 3), "#FFE066", 0)}
     ${p(LANTERN, "#FFC857")}
     ${clip("c", `<path d="${LANTERN}"/>`, ln("M40 18Q28 64 42 110M70 18Q82 64 68 110", "#F5A524", 3) + `<path d="M10 10H100V34Q55 22 10 34Z" fill="#FFD983"/>`)}
     <path d="${LANTERN}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${rc(36, 108, 38, 7, 3.5, "#C98F46", 3)}
     ${p(spark(22, 30, 7), "#FFD23F", 2)}${p(spark(92, 124, 6), "#FFD23F", 2)}
     ${gloss("M30 50q4-16 14-24")}
     ${face(55, 70, 11)}`,
  ),
  mk(
    "krathong",
    "Krathong",
    "กระทง",
    150,
    118,
    `${die(pd(KT_SIDE, KT_FOLDS, drop(75, 26, 4.5)) + `<ellipse cx="75" cy="84" rx="56" ry="13"/><ellipse cx="75" cy="62" rx="30" ry="15"/><rect x="71" y="30" width="8" height="26"/>` + sd("M64 52L56 28M86 52L94 30", 14))}
     ${p(KT_SIDE, "#7DB357")}
     ${el(75, 84, 56, 13, "#9CCB6B")}
     ${p(KT_FOLDS, "#4FA34F", 3)}
     ${ln("M64 52L56 28M86 52L94 30", "#B5713F", 2.5)}${ci(56, 28, 2.2, "#E8453C", 0)}${ci(94, 30, 2.2, "#E8453C", 0)}
     ${rc(71, 30, 8, 26, 2, "#FFF4DC", 2.5)}
     ${p(drop(75, 26, 4.5), "#FF9F1C", 2)}
     ${el(75, 62, 30, 15, "#FFA62B")}
     <g fill="#FFC75E">${[
       [60, 58],
       [75, 54],
       [90, 58],
       [66, 66],
       [84, 66],
       [75, 70],
       [52, 64],
       [98, 64],
     ]
       .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/>`)
       .join("")}</g>
     ${flower(60, 52, 3.4, "#C77DFF", "#FFF4DC", 1.5)}${flower(92, 54, 3.4, "#FF8FB1", "#FFF4DC", 1.5)}
     ${face(75, 92, 10, 0.8)}`,
  ),
  mk(
    "paper-umbrella",
    "Paper umbrella",
    "ร่มบ่อสร้าง",
    140,
    136,
    `${die(pd(UMB) + `<rect x="66" y="66" width="8" height="58" rx="4"/>`)}
     ${tube("M70 72V120", "#D9A960", 4)}
     ${p(UMB, "#E8453C")}
     ${clip(
       "c",
       `<path d="${UMB}"/>`,
       UMB_CUSPS.slice(0, 6)
         .map((x, k) => (k % 2 ? `<path d="M70 18L${x - (k === 0 ? 40 : 0)} 80L${UMB_CUSPS[k + 1] + (k === 5 ? 40 : 0)} 80Z" fill="#FF8A5B"/>` : ""))
         .join(""),
     )}
     ${ln(
       UMB_CUSPS.slice(1, 6)
         .map((x) => `M70 18L${x} 70`)
         .join(""),
       "#B82D25",
       2,
     )}
     <path d="${UMB}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${flower(48, 52, 4, "#fff", "#FFD23F", 1.5)}${flower(94, 48, 4, "#fff", "#FFD23F", 1.5)}${flower(70, 36, 3.4, "#FFD23F", "#fff", 1.5)}
     ${gloss("M34 46q8-16 22-22")}`,
  ),
  mk(
    "jasmine-garland",
    "Jasmine garland",
    "พวงมาลัย",
    110,
    150,
    `${die(`<circle cx="55" cy="48" r="32"/><rect x="49" y="76" width="12" height="40" rx="6"/><circle cx="55" cy="110" r="12"/>` + sd("M48 118Q44 126 42 134M55 120V136M62 118Q66 126 68 134", 14))}
     ${tube("M48 118Q44 126 42 134M55 120V136M62 118Q66 126 68 134", "#5DBB63", 2.5)}
     ${ci(42, 134, 3.2, "#fff", 2)}${ci(55, 136, 3.2, "#fff", 2)}${ci(68, 134, 3.2, "#fff", 2)}
     <circle cx="55" cy="48" r="24" fill="none" stroke="${O}" stroke-width="16"/><circle cx="55" cy="48" r="24" fill="none" stroke="#FFFDF5" stroke-width="9"/>
     <g fill="#E3EBD3">${Array.from({ length: 16 }, (_, i) => {
       const a = (i / 16) * Math.PI * 2;
       return `<circle cx="${f(55 + 24 * Math.cos(a))}" cy="${f(48 + 24 * Math.sin(a))}" r="1.6"/>`;
     }).join("")}</g>
     ${[0, 90, 180, 270].map((d) => ci(f(55 + 24 * Math.cos((d * Math.PI) / 180)), f(48 + 24 * Math.sin((d * Math.PI) / 180)), 5, "#FFA62B", 2.2)).join("")}
     ${ci(55, 84, 6, "#FFA62B", 2.5)}${ci(55, 96, 6, "#FFFDF5", 2.5)}
     ${ci(55, 110, 11, "#E8453C", 3)}${ln("M50 110a5 5 0 1 1 5 5", "#B82D25", 2)}
     ${gloss("M38 34q6-8 14-9", 3)}`,
  ),
];

// ---------------------------------------------------------------------------------------------
// Cute animals
// ---------------------------------------------------------------------------------------------

const CAT_BODY = "M35 124C31 100 37 80 51 72H79C93 80 99 100 95 124Z";
const CAT_EARS = ["M33 48L34 20L56 36Z", "M97 48L96 20L74 36Z"];
const CAT_TAIL = "M93 118C112 114 116 96 106 86";
const LOAF = "M18 88C18 56 40 40 75 40C110 40 132 56 132 88Q132 96 124 96H26Q18 96 18 88Z";
const LOAF_EARS = ["M36 52L40 24L60 42Z", "M114 52L110 24L90 42Z"];
const LOAF_TAIL = "M122 90C126 102 104 104 86 100";
const PUP_EARS = ["M39 40C23 40 17 66 25 84C35 82 41 66 45 50Z", "M101 40C117 40 123 66 115 84C105 82 99 66 95 50Z"];
const FROG = "M22 86C22 60 40 46 70 46C100 46 118 60 118 86C118 100 98 104 70 104C42 104 22 100 22 86Z";
const CAPY = "M16 86C16 64 30 54 52 54H98C112 42 136 46 140 64C142 76 138 86 130 92V96Q130 102 124 102H24Q16 102 16 94Z";
const AXO_GILLS = "M44 48L24 36M40 60L20 60M44 72L24 84M106 48L126 36M110 60L130 60M106 72L126 84";
const PENGUIN = "M55 16C82 16 94 44 94 78C94 110 78 126 55 126C32 126 16 110 16 78C16 44 28 16 55 16Z";
const PENGUIN_BELLY = "M55 50C60 40 74 36 80 46C86 58 84 76 82 88C80 108 70 120 55 120C40 120 30 108 28 88C26 76 24 58 30 46C36 36 50 40 55 50Z";
const PENGUIN_FLIPPERS = ["M22 70C14 82 15 94 24 98Z", "M88 70C96 82 95 94 86 98Z"];
const FOX = "M20 50C30 44 44 44 65 46C86 44 100 44 110 50C112 76 92 100 65 104C38 100 18 76 20 50Z";
const FOX_EARS = ["M24 52L28 16L54 40Z", "M106 52L102 16L76 40Z"];
const WHALE = "M16 70C16 46 40 34 72 34C104 34 126 50 130 70C130 92 104 104 72 104C40 104 16 92 16 70Z";
const WHALE_TAIL = "M124 76C132 66 136 56 134 46C142 50 152 48 156 42C158 56 146 70 130 82Z";
const WHALE_SPOUT = "M64 34C62 26 56 22 50 22M64 34C66 26 72 22 78 22";
const OCTO =
  "M24 66C24 36 42 18 65 18C88 18 106 36 106 66C106 74 112 82 118 86C112 92 104 88 100 84C98 96 104 104 112 108C102 116 90 106 88 96C86 108 82 114 76 118C70 112 70 102 70 96C66 104 60 114 52 116C48 108 50 100 52 94C46 104 36 110 24 106C28 98 32 92 34 86C26 90 18 88 14 84C20 80 24 74 24 66Z";
const SNAIL = "M16 96Q16 86 28 86H102L110 64C114 50 132 48 136 62C138 70 136 80 130 88L130 96Q130 100 126 100H20Q16 100 16 96Z";
const EGG = "M18 74L28 66L36 76L46 66L55 76L64 66L74 76L82 66L92 74V84C92 106 76 116 55 116C34 116 18 106 18 84Z";
const SHELL = "M28 78C28 48 50 32 76 32C102 32 124 48 124 78Z";
const JELLY = "M18 62C18 34 34 18 55 18C76 18 92 34 92 62C86 68 78 62 73 66C68 70 62 64 55 68C48 64 42 70 37 66C32 62 24 68 18 62Z";
const JELLY_LEGS =
  "M30 66C26 80 36 90 30 104C26 114 34 120 32 126M46 68C42 82 52 92 46 106C42 116 50 120 48 128M64 68C68 82 58 92 64 106C68 116 60 120 62 128M80 66C84 80 74 90 80 104C84 114 76 120 78 126";
const HEDGE = `M${spikes(72, 86, 58, 50, 10, 10, 180, 330).join("L")}L118 98H24Q14 98 14 90Z`;
const HEDGE_SNOUT = "M96 58C116 56 134 70 140 84C134 94 116 98 96 96Z";

const animals: LibrarySticker[] = [
  mk(
    "cat",
    "Ginger cat",
    "แมวส้ม",
    130,
    140,
    `${die(pd(CAT_BODY, ...CAT_EARS) + `<ellipse cx="65" cy="60" rx="36" ry="30"/><ellipse cx="55" cy="122" rx="9" ry="6"/><ellipse cx="75" cy="122" rx="9" ry="6"/>` + sd(CAT_TAIL, 26))}
     ${tube(CAT_TAIL, "#FFB45E", 8)}
     ${p(CAT_BODY, "#FFB45E")}
     ${el(65, 100, 15, 17, "#FFE6C4", 0)}
     ${CAT_EARS.map((d) => p(d, "#FFB45E")).join("")}
     ${p("M38 42L39 27L50 36Z", "#FF9EB5", 0)}${p("M92 42L91 27L80 36Z", "#FF9EB5", 0)}
     ${el(65, 60, 36, 30, "#FFB45E")}
     ${ln("M65 32v8M56 33l2 6M74 33l-2 6", "#E8892F", 3)}
     ${el(55, 122, 9, 6, "#FFE6C4", 3)}${el(75, 122, 9, 6, "#FFE6C4", 3)}
     ${ln("M27 64l10 2M27 72l10-1M103 64l-10 2M103 72l-10-1", O, 2)}
     ${face(65, 62, 13)}
     ${p("M62 65h6l-3 3z", "#FF8FA3", 1.5)}
     ${gloss("M38 50q3-10 12-14")}`,
  ),
  mk(
    "cat-loaf",
    "Black cat loaf",
    "แมวดำนอนหมอบ",
    150,
    120,
    `${die(pd(LOAF, ...LOAF_EARS) + sd(LOAF_TAIL, 24))}
     ${LOAF_EARS.map((d) => p(d, "#4A4458")).join("")}
     ${p("M41 46L43 32L53 41Z", "#FF9EB5", 0)}${p("M109 46L107 32L97 41Z", "#FF9EB5", 0)}
     ${p(LOAF, "#4A4458")}
     ${ln("M28 88Q75 96 122 88", "#3A3446", 5)}
     ${el(60, 94, 8, 5, "#fff", 2.5)}${el(90, 94, 8, 5, "#fff", 2.5)}
     ${tube(LOAF_TAIL, "#4A4458", 8)}
     ${[58, 92].map((x) => el(x, 66, 7, 8, "#F9E27D", 2.5) + el(x, 67, 2.4, 5.2, O, 0) + ci(x + 2, 63, 1.6, "#fff", 0)).join("")}
     ${p("M72 75h6l-3 3z", "#FF9EB5", 0)}
     ${ln("M75 78q-3 4-6 1M75 78q3 4 6 1", "#E9E2F2", 2)}
     ${ln("M30 74l14 2M30 82l14-1M120 74l-14 2M120 82l-14-1", "#B7AEC6", 2)}
     <g fill="#FF8FA3" opacity=".6"><ellipse cx="46" cy="80" rx="5" ry="3"/><ellipse cx="104" cy="80" rx="5" ry="3"/></g>
     ${gloss("M32 64q6-14 20-20")}`,
  ),
  mk(
    "pup",
    "Floppy-eared pup",
    "ลูกหมาหูตก",
    140,
    124,
    `${die(pd(...PUP_EARS) + `<ellipse cx="70" cy="66" rx="38" ry="34"/>`)}
     ${el(70, 66, 38, 34, "#F6D7A7")}
     ${el(86, 56, 12, 10, "#E2B078", 0)}
     ${PUP_EARS.map((d) => p(d, "#B9794D")).join("")}
     ${el(70, 82, 17, 12, "#FFF8EE", 3)}
     ${el(70, 76, 6, 4.5, O, 0)}${ci(68, 74.5, 1.4, "#fff", 0)}
     ${ln("M70 80v4M64 84q3 3 6 0q3 3 6 0", O, 2.4)}
     ${p("M67 86q3 8 6 0z", "#FF6F86", 2)}
     ${eyes(70, 60, 15)}${cheeks(70, 62, 17, 0.9)}
     ${gloss("M42 52q4-12 14-16")}`,
  ),
  mk(
    "frog",
    "Happy frog",
    "กบน้อย",
    140,
    122,
    `${die(pd(FROG) + `<circle cx="46" cy="42" r="17"/><circle cx="94" cy="42" r="17"/><ellipse cx="36" cy="104" rx="12" ry="6"/><ellipse cx="104" cy="104" rx="12" ry="6"/>`)}
     ${el(36, 104, 12, 6, "#5CC245", 3)}${el(104, 104, 12, 6, "#5CC245", 3)}
     ${p(FROG, "#7ED957")}
     ${ci(46, 42, 17, "#7ED957")}${ci(94, 42, 17, "#7ED957")}
     ${p("M30 52Q70 40 110 52", "#7ED957", 0)}
     ${el(70, 88, 26, 13, "#C9F2A8", 0)}
     ${[46, 94].map((x) => ci(x, 42, 10, "#fff", 2.5) + ci(x + 2, 43, 5, O, 0) + ci(x + 3.5, 41, 1.6, "#fff", 0)).join("")}
     <g fill="#FF8FA3" opacity=".75"><ellipse cx="36" cy="68" rx="6" ry="3.5"/><ellipse cx="104" cy="68" rx="6" ry="3.5"/></g>
     ${ln("M52 68Q70 80 88 68", O, 3)}
     ${gloss("M34 36q3-6 9-8", 3)}`,
  ),
  mk(
    "capybara",
    "Chill capybara",
    "คาปิบาร่าชิลๆ",
    160,
    120,
    `${die(pd(CAPY, "M118 30q6-8 12-4q-6 6-12 4Z") + `<ellipse cx="108" cy="48" rx="6" ry="5"/><ellipse cx="36" cy="104" rx="8" ry="5"/><ellipse cx="112" cy="104" rx="8" ry="5"/><circle cx="118" cy="40" r="10"/>`)}
     ${el(36, 104, 8, 5, "#A8743F", 3)}${el(112, 104, 8, 5, "#A8743F", 3)}
     ${el(108, 48, 6, 5, "#9C6A3E", 2.5)}
     ${p(CAPY, "#C08A55")}
     ${ln("M26 94Q70 102 120 94", "#A8743F", 5)}
     ${el(132, 72, 9, 8, "#A8743F", 0)}
     ${el(136, 66, 1.8, 2.6, O, 0)}
     ${ln("M112 64q4 3 8 0", O, 3)}
     ${ln("M128 80q3 2 6 0", O, 2.4)}
     <ellipse cx="120" cy="76" rx="5" ry="3" fill="#FF8FA3" opacity=".75"/>
     ${ci(118, 40, 10, "#FF9F1C", 3)}${p("M118 30q6-8 12-4q-6 6-12 4Z", "#5DBB63", 2)}${gloss("M112 38q1-4 4-5", 2)}
     ${gloss("M30 70q8-12 22-14")}`,
  ),
  mk(
    "axolotl",
    "Axolotl",
    "แอกโซลอเติล",
    150,
    118,
    `${die(`<ellipse cx="75" cy="58" rx="38" ry="28"/><ellipse cx="75" cy="94" rx="22" ry="12"/>` + sd(AXO_GILLS, 26))}
     ${el(75, 94, 22, 12, "#FFC1D3")}
     ${el(58, 98, 6, 4, "#FFC1D3", 2.5)}${el(92, 98, 6, 4, "#FFC1D3", 2.5)}
     ${tube(AXO_GILLS, "#FF7FA6", 8)}
     ${[
       [24, 36],
       [20, 60],
       [24, 84],
       [126, 36],
       [130, 60],
       [126, 84],
     ]
       .map(([x, y]) => ci(x, y, 5.5, "#FF7FA6", 3))
       .join("")}
     ${el(75, 58, 38, 28, "#FFC1D3")}
     ${ln("M46 72Q75 90 104 72", "#FFA9C0", 5)}
     ${eyes(75, 56, 16)}${cheeks(75, 56, 16)}
     ${ln("M66 64q9 8 18 0", O, 3)}
     ${gloss("M48 46q4-10 14-14")}`,
  ),
  mk(
    "penguin",
    "Penguin",
    "เพนกวิน",
    110,
    146,
    `${die(pd(PENGUIN, ...PENGUIN_FLIPPERS) + `<ellipse cx="42" cy="128" rx="10" ry="5"/><ellipse cx="68" cy="128" rx="10" ry="5"/>`)}
     ${el(42, 128, 10, 5, "#FFA62B", 3)}${el(68, 128, 10, 5, "#FFA62B", 3)}
     ${PENGUIN_FLIPPERS.map((d) => p(d, "#2F3A56")).join("")}
     ${p(PENGUIN, "#2F3A56")}
     ${p(PENGUIN_BELLY, "#fff", 0)}
     ${eyes(55, 62, 11, 0.9)}${cheeks(55, 62, 11, 0.9)}
     ${p("M50 70h10l-5 6Z", "#FFA62B", 2)}
     ${gloss("M30 36q6-12 16-15", 3.5)}`,
  ),
  mk(
    "bear",
    "Brown bear",
    "หมีสีน้ำตาล",
    130,
    120,
    `${die(`<circle cx="32" cy="38" r="14"/><circle cx="98" cy="38" r="14"/><ellipse cx="65" cy="66" rx="42" ry="36"/>`)}
     ${ci(32, 38, 14, "#B98352")}${ci(98, 38, 14, "#B98352")}
     ${ci(32, 38, 7, "#E8B48A", 0)}${ci(98, 38, 7, "#E8B48A", 0)}
     ${el(65, 66, 42, 36, "#B98352")}
     ${el(65, 82, 18, 13, "#F3D9B8", 3)}
     ${el(65, 76, 6, 4.5, O, 0)}${ci(63, 74.5, 1.4, "#fff", 0)}
     ${ln("M65 80.5v3.5M60 84q2.5 3 5 0q2.5 3 5 0", O, 2.6)}
     ${eyes(65, 62, 18)}${cheeks(65, 64, 18)}
     ${gloss("M34 52q5-12 16-16")}`,
  ),
  mk(
    "bunny",
    "Bunny",
    "กระต่ายน้อย",
    120,
    136,
    `${die(`<ellipse cx="44" cy="46" rx="11" ry="27" transform="rotate(-8 44 46)"/><ellipse cx="76" cy="46" rx="11" ry="27" transform="rotate(8 76 46)"/><ellipse cx="60" cy="90" rx="38" ry="32"/>`)}
     ${el(44, 46, 11, 27, "#FBF4EE", S, -8)}${el(76, 46, 11, 27, "#FBF4EE", S, 8)}
     ${el(44, 50, 5, 18, "#FFB3C7", 0, -8)}${el(76, 50, 5, 18, "#FFB3C7", 0, 8)}
     ${el(60, 90, 38, 32, "#FBF4EE")}
     ${flower(84, 66, 4, "#FFD23F", "#FF8A3D", 1.8)}
     ${eyes(60, 88, 13)}${cheeks(60, 88, 13)}
     ${p("M57 94h6l-3 3z", "#FF8FA3", 1.5)}
     ${ln("M60 97v2M56 99q2 3 4 0q2 3 4 0", O, 2.2)}
     ${gloss("M30 80q4-12 14-16")}`,
  ),
  mk(
    "fox",
    "Little fox",
    "จิ้งจอกน้อย",
    130,
    116,
    `${die(pd(FOX, ...FOX_EARS))}
     ${FOX_EARS.map((d) => p(d, "#FF8A3D")).join("")}
     ${p("M30 44L32 26L46 38Z", "#FFE3CC", 0)}${p("M100 44L98 26L84 38Z", "#FFE3CC", 0)}
     ${p(FOX, "#FF8A3D")}
     ${clip("c", `<path d="${FOX}"/>`, `<path d="M38 68C50 68 60 76 65 98C70 76 80 68 92 68C100 86 84 104 65 106C46 104 30 86 38 68Z" fill="#FFF6EC"/>`)}
     <path d="${FOX}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${el(65, 94, 5, 4, O, 0)}
     ${ln("M65 98v2M61 100q2 3 4 0q2 3 4 0", O, 2.2)}
     ${happyEyes(65, 66, 16)}${cheeks(65, 66, 18)}
     ${gloss("M30 58q2-6 8-8", 3)}`,
  ),
  mk(
    "whale",
    "Blue whale",
    "วาฬสีฟ้า",
    170,
    116,
    `${die(pd(WHALE, WHALE_TAIL) + sd(WHALE_SPOUT, 16) + `<circle cx="46" cy="22" r="3"/><circle cx="82" cy="22" r="3"/>`)}
     ${tube(WHALE_SPOUT, "#7FD0F5", 3.5)}${ci(46, 22, 3, "#7FD0F5", 2)}${ci(82, 22, 3, "#7FD0F5", 2)}
     ${p(WHALE_TAIL, "#5BA8E8")}
     ${p(WHALE, "#5BA8E8")}
     ${clip("c", `<path d="${WHALE}"/>`, `<path d="M10 80C40 98 100 102 140 80V110H10Z" fill="#CFEAF7"/>${ln("M50 92v10M66 94v10M82 94v10M98 92v10", "#A9D6EE", 2.5)}`)}
     <path d="${WHALE}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${p("M76 84q-4 12 8 14q2-8-8-14Z", "#4A93D4", 2.5)}
     ${gloss("M30 52q8-10 20-12")}
     ${face(48, 64, 10)}`,
  ),
  mk(
    "octopus",
    "Octopus",
    "ปลาหมึกยักษ์",
    140,
    130,
    `<g transform="translate(5 0)">
       ${die(pd(OCTO))}
       ${p(OCTO, "#FF7A6B")}
       <g fill="#FF9E8F"><circle cx="40" cy="44" r="5"/><circle cx="92" cy="40" r="4"/><circle cx="98" cy="56" r="3"/><circle cx="34" cy="60" r="3"/></g>
       ${ln("M30 72Q65 84 100 72", "#E85F50", 4)}
       ${gloss("M38 36q6-10 16-14")}
       ${face(65, 52, 12)}
     </g>`,
  ),
  mk(
    "bee",
    "Busy bee",
    "ผึ้งน้อย",
    150,
    116,
    `${die(`<ellipse cx="78" cy="70" rx="42" ry="30"/><ellipse cx="66" cy="38" rx="12" ry="17" transform="rotate(-20 66 38)"/><ellipse cx="90" cy="36" rx="12" ry="17" transform="rotate(20 90 36)"/>` + pd("M118 64L134 70L118 76Z") + sd("M50 46Q42 32 34 32", 16) + `<circle cx="34" cy="32" r="4"/>`)}
     ${el(66, 38, 12, 17, "#E8F6FF", 3, -20)}${el(90, 36, 12, 17, "#E8F6FF", 3, 20)}
     ${p("M118 64L134 70L118 76Z", "#3A2E2A", 3)}
     ${ln("M50 46Q42 32 34 32", O, 3)}${ci(34, 32, 4, O, 0)}
     ${el(78, 70, 42, 30, "#FFD23F")}
     ${clip("c", `<ellipse cx="78" cy="70" rx="42" ry="30"/>`, `<g fill="#3A2E2A"><rect x="80" y="30" width="11" height="80"/><rect x="101" y="30" width="11" height="80"/></g>`)}
     <ellipse cx="78" cy="70" rx="42" ry="30" fill="none" stroke="${O}" stroke-width="${S}"/>
     ${gloss("M44 58q5-10 14-13")}
     ${face(58, 70, 9, 0.9)}`,
  ),
  mk(
    "snail",
    "Slow snail",
    "หอยทากเดินช้า",
    160,
    112,
    `${die(pd(SNAIL) + `<circle cx="68" cy="58" r="30"/><circle cx="114" cy="32" r="4.5"/><circle cx="134" cy="32" r="4.5"/>` + sd("M120 54L114 34M128 54L134 34", 14))}
     ${ln("M120 54L114 34M128 54L134 34", O, 3)}
     ${ci(114, 32, 4.5, "#B8E07A", 2.5)}${ci(134, 32, 4.5, "#B8E07A", 2.5)}
     ${p(SNAIL, "#C9E88F")}
     ${ln("M24 94H120", "#A9D06A", 4)}
     ${ci(68, 58, 30, "#FFA65C")}
     ${ln("M68 58m-3 0a3 3 0 1 1 6 0a9 9 0 1 1 -16 1a15 15 0 1 1 28 0a21 21 0 1 1 -38 -2", "#E07A35", 3)}
     ${gloss("M46 46q4-8 12-11")}
     ${face(124, 70, 6, 0.7)}`,
  ),
  mk(
    "chick",
    "Hatching chick",
    "ลูกเจี๊ยบฟักไข่",
    110,
    128,
    `${die(pd(EGG, "M52 26C50 18 56 14 60 18C62 14 68 16 66 22Z") + `<circle cx="55" cy="54" r="30"/>`)}
     ${p("M52 26C50 18 56 14 60 18C62 14 68 16 66 22Z", "#FFD23F", 2.5)}
     ${ci(55, 54, 30, "#FFD23F")}
     ${el(30, 62, 6, 9, "#FFC21A", 2.5, 20)}${el(80, 62, 6, 9, "#FFC21A", 2.5, -20)}
     ${eyes(55, 48, 11)}${cheeks(55, 48, 11)}
     ${p("M50 56h10l-5 6Z", "#FFA62B", 2)}
     ${gloss("M34 42q4-10 12-13", 3.5)}
     ${p(EGG, "#FFFDF6")}
     ${ln("M26 96Q55 114 84 96", "#EFE6D2", 5)}
     <g fill="#EADFC8"><circle cx="36" cy="90" r="2.2"/><circle cx="72" cy="100" r="2.6"/><circle cx="60" cy="88" r="1.8"/></g>`,
  ),
  mk(
    "panda",
    "Panda",
    "แพนด้า",
    130,
    120,
    `${die(`<circle cx="32" cy="38" r="14"/><circle cx="98" cy="38" r="14"/><ellipse cx="65" cy="66" rx="42" ry="36"/>` + pd("M90 34C96 22 108 18 114 22C110 32 100 36 90 34Z"))}
     ${ci(32, 38, 14, "#3A3340")}${ci(98, 38, 14, "#3A3340")}
     ${el(65, 66, 42, 36, "#FBFAF7")}
     ${p("M90 34C96 22 108 18 114 22C110 32 100 36 90 34Z", "#5DBB63", 2.5)}${ln("M92 33Q102 26 112 23", "#3F9A4B", 1.8)}
     ${el(47, 64, 10, 12, "#3A3340", 0, 25)}${el(83, 64, 10, 12, "#3A3340", 0, -25)}
     ${[48, 82].map((x) => ci(x, 63, 4.2, "#fff", 0) + ci(x + 0.6, 63.6, 2.4, O, 0) + ci(x + 1.4, 62.4, 0.9, "#fff", 0)).join("")}
     ${el(65, 78, 6, 4.5, O, 0)}
     ${ln("M65 82v3M60 85q2.5 3 5 0q2.5 3 5 0", O, 2.4)}
     <g fill="#FF8FA3" opacity=".75"><ellipse cx="38" cy="82" rx="6" ry="3.5"/><ellipse cx="92" cy="82" rx="6" ry="3.5"/></g>
     ${gloss("M34 52q5-12 16-16")}`,
  ),
  mk(
    "turtle",
    "Sea turtle",
    "เต่าน้อย",
    160,
    112,
    `${die(pd(SHELL, "M22 80l-6 3 6 2Z") + `<rect x="20" y="74" width="110" height="12" rx="6"/><rect x="112" y="62" width="22" height="14" rx="7"/><circle cx="132" cy="62" r="16"/><ellipse cx="42" cy="90" rx="10" ry="7"/><ellipse cx="108" cy="90" rx="10" ry="7"/>`)}
     ${p("M22 80l-6 3 6 2Z", "#8ED18C", 2.5)}
     ${el(42, 90, 10, 7, "#8ED18C", 3)}${el(108, 90, 10, 7, "#8ED18C", 3)}
     ${rc(112, 62, 22, 14, 7, "#8ED18C", 3)}
     ${ci(132, 62, 16, "#8ED18C")}
     ${p(SHELL, "#6CBF6A")}
     ${p("M76 46l12 7v14l-12 7-12-7V53Z", "#58A957", 2.5)}
     ${ln("M76 46V34M88 53l14-8M88 67l16 8M64 67l-16 8M64 53l-14-8", "#58A957", 2.5)}
     ${rc(20, 74, 110, 12, 6, "#4E9E52")}
     ${gloss("M40 60q6-14 20-20")}
     ${eyes(134, 60, 6, 0.7)}${cheeks(134, 60, 5, 0.6)}${smile(134, 58, 0.7)}`,
  ),
  mk(
    "jellyfish",
    "Jellyfish",
    "แมงกะพรุน",
    110,
    140,
    `${die(pd(JELLY) + sd(JELLY_LEGS, 16))}
     ${tube(JELLY_LEGS, "#FF9EC7", 3.5)}
     ${p(JELLY, "#C8B6FF")}
     <g fill="#DCD0FF"><circle cx="36" cy="38" r="4"/><circle cx="74" cy="34" r="3"/><circle cx="80" cy="50" r="2.5"/></g>
     ${gloss("M28 46q3-12 13-18")}
     ${face(55, 48, 11)}`,
  ),
  mk(
    "hedgehog",
    "Hedgehog",
    "เม่นแคระ",
    160,
    116,
    `${die(pd(HEDGE, HEDGE_SNOUT) + `<ellipse cx="44" cy="98" rx="8" ry="5"/><ellipse cx="100" cy="98" rx="8" ry="5"/><circle cx="62" cy="44" r="8"/><circle cx="140" cy="84" r="4.5"/>`)}
     ${el(44, 98, 8, 5, "#D9B48C", 3)}${el(100, 98, 8, 5, "#D9B48C", 3)}
     ${p(HEDGE, "#9C6B48")}
     ${ln("M34 72l8-6M50 58l8-6M72 54l6-8M44 84l8-6M62 72l8-6M84 66l6-7M30 88l6-4", "#7A4E30", 2.6)}
     ${p(HEDGE_SNOUT, "#F6DDB8")}
     ${ci(140, 84, 4.5, O, 0)}
     ${el(116, 74, 3, 4, O, 0)}${ci(117, 72.5, 1.2, "#fff", 0)}
     <ellipse cx="120" cy="86" rx="4.5" ry="2.6" fill="#FF8FA3" opacity=".75"/>
     ${ln("M128 90q4 3 7 0", O, 2.4)}
     ${ci(62, 44, 8, "#F0544F", 3)}${p("M62 36q4-6 9-4q-3 5-9 4Z", "#5DBB63", 2)}`,
  ),
];

// ---------------------------------------------------------------------------------------------
// Nature & weather
// ---------------------------------------------------------------------------------------------

const SUN_RAYS = star(70, 70, 54, 40, 12);
const CLOUD = `<circle cx="48" cy="62" r="22"/><circle cx="76" cy="48" r="28"/><circle cx="104" cy="60" r="22"/><rect x="30" y="58" width="92" height="30" rx="15"/>`;
const RAIN = [drop(54, 112, 6), drop(76, 120, 6), drop(98, 112, 6)];
const RB_BAND = "M20 92A70 70 0 0 1 160 92H108A18 18 0 0 0 72 92Z";
const RB_CLOUD_L = `<circle cx="28" cy="92" r="13"/><circle cx="46" cy="84" r="18"/><circle cx="64" cy="94" r="12"/><rect x="18" y="90" width="56" height="16" rx="8"/>`;
const RB_CLOUD_R = `<circle cx="152" cy="92" r="13"/><circle cx="134" cy="84" r="18"/><circle cx="116" cy="94" r="12"/><rect x="106" y="90" width="56" height="16" rx="8"/>`;
const CACTUS = `<rect x="40" y="22" width="30" height="80" rx="15"/><rect x="18" y="40" width="14" height="34" rx="7"/><rect x="22" y="62" width="24" height="12" rx="6"/><rect x="78" y="32" width="14" height="30" rx="7"/><rect x="64" y="50" width="24" height="12" rx="6"/>`;
const POT = "M28 104H82L76 132Q75 136 70 136H40Q35 136 34 132Z";
const LEAF = "M66 122C36 116 16 92 16 62C16 34 38 16 62 22C64 23 66 25 68 28C72 22 82 18 92 18C114 18 126 40 122 66C118 96 96 116 66 122Z";
const SLITS = ["M6 40L54 54L8 56Z", "M8 74L56 78L14 92Z", "M22 104L58 96L40 120Z", "M134 36L80 52L132 54Z", "M132 74L80 76L126 90Z", "M112 108L78 96L96 122Z"];
const BOLETE_CAP = "M16 60C18 36 38 22 62 22C86 22 106 36 108 60C108 70 96 74 62 74C28 74 16 70 16 60Z";
const BOLETE_STEM = "M40 70C34 90 34 106 42 112C52 116 72 116 82 112C90 106 90 90 84 70Z";
const GRASS = "M20 104Q20 94 32 94H128Q140 94 140 104Q140 112 130 112H30Q20 112 20 104Z";
const CAPS = [
  "M28 78C28 62 38 54 45 54C52 54 62 62 62 78Z",
  "M56 58C56 34 70 24 80 24C90 24 104 34 104 58Z",
  "M98 74C98 58 108 50 117 50C126 50 136 58 136 74Z",
];
const PETALS = Array.from({ length: 12 }, (_, i) => `<ellipse cx="62" cy="34" rx="9" ry="17" transform="rotate(${i * 30} 62 62)"/>`);
const TULIP = "M26 40C26 64 36 78 50 78C64 78 74 64 74 40C66 46 60 46 56 34L50 22L44 34C40 46 34 46 26 40Z";
const TULIP_LEAVES = ["M50 122C30 118 22 100 24 84C38 90 48 104 50 122Z", "M50 112C68 108 78 94 78 78C64 84 52 96 50 112Z"];
const CURL = "M18 106C16 66 40 30 82 24C112 20 132 40 128 62C124 78 104 82 96 70C90 60 98 50 106 54C106 42 94 36 82 40C60 48 50 76 58 106Z";
const CURL_BASE = "M18 100Q33 93 48 100T78 100T108 100T138 100V108Q138 114 132 114H24Q18 114 18 108Z";
const MOON = "M74 16C46 18 22 40 22 68C22 94 44 114 72 114C88 114 102 108 110 98C82 100 60 82 60 58C60 40 68 26 74 16Z";
const STARS = [star(64, 66, 44, 20, 5), star(118, 36, 18, 8, 5), star(124, 92, 14, 6, 5)];
const SEED_POT = "M24 72H76L70 118Q69 124 63 124H37Q31 124 30 118Z";

const nature: LibrarySticker[] = [
  mk(
    "sun",
    "Sunny",
    "พระอาทิตย์ยิ้ม",
    140,
    140,
    `${die(pd(SUN_RAYS))}
     ${p(SUN_RAYS, "#FFA62B")}
     ${ci(70, 70, 32, "#FFD23F")}
     ${ln("M46 88Q70 104 94 88", "#FFC21A", 5)}
     ${gloss("M48 58q4-10 14-14")}
     ${happy(70, 70, 12)}`,
  ),
  mk(
    "rain-cloud",
    "Rain cloud",
    "เมฆฝน",
    150,
    138,
    `${die(CLOUD + pd(...RAIN))}
     ${RAIN.map((d) => p(d, "#4C8DFF", 3)).join("")}
     ${ln("M52 104v4M74 112v4M96 104v4", "#fff", 2.5)}
     ${blob(CLOUD, "#EAF2FB")}
     ${ln("M40 82H112", "#CFDDF0", 5)}
     ${gloss("M58 34q8-8 18-8")}
     ${sleepy(76, 64, 12)}`,
  ),
  mk(
    "rainbow",
    "Rainbow",
    "สายรุ้ง",
    180,
    120,
    `${die(pd(RB_BAND) + RB_CLOUD_L + RB_CLOUD_R)}
     ${p(RB_BAND, O, 0)}
     ${[
       [62, "#FF6B6B"],
       [53, "#FFA62B"],
       [44, "#FFD23F"],
       [35, "#7AE582"],
       [26, "#4C8DFF"],
     ]
       .map(([r, c]) => `<path d="M${90 - +r} 92A${r} ${r} 0 0 1 ${90 + +r} 92" fill="none" stroke="${c}" stroke-width="9"/>`)
       .join("")}
     ${blob(RB_CLOUD_L, "#fff")}${blob(RB_CLOUD_R, "#fff")}
     ${happy(46, 92, 7, 0.65)}
     ${face(134, 92, 7, 0.65)}`,
  ),
  mk(
    "cactus",
    "Potted cactus",
    "กระบองเพชร",
    110,
    148,
    `${die(CACTUS + pd(POT) + `<rect x="22" y="94" width="66" height="12" rx="4"/><circle cx="55" cy="22" r="9"/>`)}
     ${blob(CACTUS, "#6CC46B")}
     ${ln("M45 34V94M65 34V94M25 48v18M85 38v16", "#4FA34F", 2.5)}
     ${ln("M38 46l-4-1M38 84l-4 1M72 42l4-1M72 88l4 1M18 54h-3M92 44h3", O, 1.8)}
     ${flower(55, 22, 4, "#FF7AB6", "#FFD23F", 2)}
     ${p(POT, "#E07A4F")}
     ${rc(22, 94, 66, 12, 4, "#F09062")}
     ${face(55, 66, 6, 0.75)}`,
  ),
  mk(
    "monstera",
    "Monstera leaf",
    "ใบมอนสเตอร่า",
    140,
    150,
    `${die(pd(LEAF) + sd("M66 120Q66 128 70 134", 20))}
     ${tube("M66 120Q66 128 70 134", "#4FA34F", 4)}
     <defs><mask id="m"><rect width="140" height="150" fill="#fff"/>${SLITS.map((d) => `<path d="${d}" fill="#000"/>`).join("")}</mask></defs>
     <g mask="url(#m)">
       ${p(LEAF, "#5BBE5E")}
       ${clip("c", `<path d="${LEAF}"/>`, `<path d="M68 20Q76 70 66 124H140V0H68Z" fill="#4CAF50"/>`)}
       <path d="${LEAF}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
       ${ln("M68 30Q74 74 66 118", "#3F9A4B", 3)}
       ${gloss("M28 44q8-14 22-18")}
     </g>
     ${clip("k", `<path d="${LEAF}"/>`, SLITS.map((d) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`).join(""))}
     ${el(36, 66, 4, 2.5, "#fff", 2.5)}${el(104, 64, 4, 2.5, "#fff", 2.5)}`,
  ),
  mk(
    "bolete",
    "Forest mushroom",
    "เห็ดป่า",
    124,
    126,
    `${die(pd(BOLETE_CAP, BOLETE_STEM))}
     ${p(BOLETE_STEM, "#FFF0D6")}
     <g fill="#EAD7B5"><circle cx="48" cy="100" r="2"/><circle cx="78" cy="102" r="2"/><circle cx="64" cy="108" r="1.6"/></g>
     ${p(BOLETE_CAP, "#A0612F")}
     ${ln("M24 64Q62 76 100 64", "#85491F", 4)}
     <g fill="#E9C08F"><circle cx="44" cy="40" r="3"/><circle cx="70" cy="32" r="2.4"/><circle cx="88" cy="46" r="2.8"/><circle cx="58" cy="54" r="2"/></g>
     ${gloss("M28 46q6-14 20-18")}
     ${face(62, 90, 9, 0.85)}`,
  ),
  mk(
    "mushroom-trio",
    "Mushroom friends",
    "แก๊งเห็ดจิ๋ว",
    160,
    122,
    `${die(pd(GRASS, ...CAPS) + `<rect x="38" y="74" width="14" height="24" rx="6"/><rect x="72" y="52" width="16" height="46" rx="7"/><rect x="110" y="70" width="14" height="28" rx="6"/>`)}
     ${rc(38, 74, 14, 24, 6, "#FFF4E2", 3)}${rc(72, 52, 16, 46, 7, "#FFF4E2", 3)}${rc(110, 70, 14, 28, 6, "#FFF4E2", 3)}
     ${p(CAPS[0], "#FF8FB1")}${p(CAPS[1], "#A88BEB")}${p(CAPS[2], "#FFD23F")}
     <g fill="#fff"><circle cx="36" cy="66" r="2.6"/><circle cx="54" cy="62" r="2"/><circle cx="66" cy="40" r="3.2"/><circle cx="92" cy="36" r="2.6"/><circle cx="96" cy="50" r="2"/></g>
     <g fill="#FF9F1C"><circle cx="106" cy="64" r="2.4"/><circle cx="126" cy="60" r="2.8"/></g>
     ${face(80, 46, 8, 0.7)}${happy(45, 66, 5, 0.5)}${sleepy(117, 64, 5, 0.5)}
     ${p(GRASS, "#7ED957")}
     ${p("M34 96l4-10 4 10ZM66 96l3-8 3 8ZM98 96l4-10 4 10ZM124 96l3-8 3 8Z", "#5CC245", 2)}`,
  ),
  mk(
    "daisy",
    "Daisy",
    "ดอกเดซี่",
    124,
    124,
    `${die(PETALS.join(""))}
     ${PETALS.map((s, i) => s.replace("/>", ` fill="${i % 2 ? "#FFE3EE" : "#fff"}" stroke="${O}" stroke-width="3"/>`)).join("")}
     ${ci(62, 62, 20, "#FFD23F")}
     ${gloss("M50 52q3-5 8-6", 3)}
     ${face(62, 64, 8, 0.8)}`,
  ),
  mk(
    "tulip",
    "Tulip",
    "ดอกทิวลิป",
    100,
    146,
    `${die(pd(TULIP, ...TULIP_LEAVES) + sd("M50 74V128", 18))}
     ${tube("M50 74V128", "#5DBB63", 5)}
     ${TULIP_LEAVES.map((d) => p(d, "#6CC46B")).join("")}
     ${p(TULIP, "#FF5D6C")}
     ${ln("M38 48C40 62 44 72 50 76C56 72 60 62 62 48", "#E8434F", 3)}
     ${gloss("M32 46q0 10 4 16", 3)}
     ${face(50, 58, 8, 0.8)}`,
  ),
  mk(
    "curl-wave",
    "Curling wave",
    "คลื่นม้วน",
    150,
    124,
    `${die(pd(CURL, CURL_BASE))}
     ${p(CURL, "#3D8BE0")}
     ${clip("c", `<path d="${CURL}"/>`, ln("M28 104C28 72 46 46 76 36", "#5FA6EE", 9) + ln("M100 62C96 56 100 52 104 54", "#7FC3F5", 4))}
     <path d="${CURL}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${ln("M44 42C58 30 80 26 100 30", "#fff", 4)}
     <g fill="#fff"><circle cx="112" cy="30" r="2.6"/><circle cx="120" cy="38" r="2"/><circle cx="36" cy="52" r="2.2"/></g>
     ${p(CURL_BASE, "#7FC3F5")}
     ${ln("M30 106h18M92 108h20", "#fff", 3)}
     ${face(36, 80, 7, 0.75)}`,
  ),
  mk(
    "sleepy-moon",
    "Sleepy moon",
    "พระจันทร์ง่วงนอน",
    130,
    124,
    `${die(pd(MOON, spark(104, 80, 6)) + text(98, 50, "z", 16, "#fff") + text(112, 34, "Z", 20, "#fff"))}
     ${p(MOON, "#FFE07A")}
     <g fill="#F5C94A"><circle cx="46" cy="96" r="4"/><circle cx="36" cy="46" r="3"/><circle cx="64" cy="104" r="2.5"/></g>
     ${gloss("M50 26q-12 8-18 20")}
     ${sleepy(42, 66, 8, 0.85)}
     ${text(98, 50, "z", 16, "#8B7CF6", { stroke: O, sw: 3 })}${text(112, 34, "Z", 20, "#8B7CF6", { stroke: O, sw: 3 })}
     ${p(spark(104, 80, 6), "#FFD23F", 2)}`,
  ),
  mk(
    "twinkle-stars",
    "Twinkle stars",
    "ดาวระยิบระยับ",
    150,
    124,
    `${die(pd(...STARS))}
     ${p(STARS[1], "#FF8FB8", 3)}${p(STARS[2], "#7FC4FF", 3)}
     ${p(STARS[0], "#FFD23F")}
     ${clip("c", `<path d="${STARS[0]}"/>`, `<path d="M64 66L150 40V130H64Z" fill="#FFC21A"/>`)}
     <path d="${STARS[0]}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${gloss("M58 34l-3 8", 3)}
     ${happy(64, 70, 9, 0.85)}
     ${eyes(118, 38, 4, 0.4)}${eyes(124, 93, 3, 0.35)}`,
  ),
  mk(
    "seedling",
    "Little sprout",
    "ต้นกล้า",
    100,
    136,
    `${die(pd(SEED_POT, "M50 46C38 48 26 40 24 26C38 24 48 32 50 46Z", "M50 40C58 30 72 26 80 32C76 44 62 48 50 40Z") + `<rect x="20" y="66" width="60" height="12" rx="5"/>` + sd("M50 66V44", 14))}
     ${tube("M50 66V44", "#5DBB63", 3.5)}
     ${p("M50 46C38 48 26 40 24 26C38 24 48 32 50 46Z", "#7ED957", 3)}${p("M50 40C58 30 72 26 80 32C76 44 62 48 50 40Z", "#5DBB63", 3)}
     ${ln("M48 44C40 40 34 36 30 30M52 39C60 35 68 33 74 33", "#3F9A4B", 2)}
     ${p(SEED_POT, "#F4D35E")}
     ${rc(20, 66, 60, 12, 5, "#FFE07A")}
     ${el(50, 70, 22, 2.5, "#7A5230", 0)}
     ${gloss("M33 86l3 22", 3.5)}
     ${face(50, 94, 10)}`,
  ),
];

// ---------------------------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------------------------

const R_BODY = "M57 14C78 30 84 58 80 96H34C30 58 36 30 57 14Z";
const R_FINS = ["M34 74L18 96L22 108L36 98Z", "M80 74L96 96L92 108L78 98Z"];
const R_FLAME = "M44 104C44 120 52 132 57 140C62 132 70 120 70 104Z";
const UFO_DOME = "M54 58C54 34 70 24 85 24C100 24 116 34 116 58Z";
const UFO_BEAM = "M62 82L48 108H122L108 82Z";
const VISOR = "M32 60C32 40 48 32 67 32C86 32 102 40 102 60C102 80 86 88 67 88C48 88 32 80 32 60Z";
const COMET = "M118 32C86 22 46 22 16 36C40 40 60 44 78 48C56 52 36 58 20 70C50 72 84 70 116 70Z";
const A_HEAD = "M60 22C88 22 100 42 100 62C100 84 82 96 60 96C38 96 20 84 20 62C20 42 32 22 60 22Z";
const A_BODY = "M42 92C38 106 38 120 44 126H76C82 120 82 106 78 92Z";

const space: LibrarySticker[] = [
  mk(
    "rocket",
    "Rocket",
    "จรวด",
    114,
    152,
    `${die(pd(R_BODY, ...R_FINS, R_FLAME) + `<rect x="40" y="94" width="34" height="10" rx="4"/>`)}
     ${p(R_FLAME, "#FF9F1C", 3)}${p("M50 104C50 116 54 124 57 130C60 124 64 116 64 104Z", "#FFE066", 0)}
     ${R_FINS.map((d) => p(d, "#FF6B6B")).join("")}
     ${rc(40, 94, 34, 10, 4, "#8E9AAF", 3)}
     ${p(R_BODY, "#F4F1EA")}
     ${clip("c", `<path d="${R_BODY}"/>`, `<rect x="0" y="0" width="114" height="36" fill="#FF6B6B"/><rect x="0" y="80" width="114" height="20" fill="#E3DED2"/>`)}
     <path d="${R_BODY}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${ln("M37 36H77", O, 3)}
     ${ci(57, 58, 14, "#fff")}${ci(57, 58, 10, "#7FD0F5", 2.5)}
     ${face(57, 57, 4, 0.5)}
     ${gloss("M42 74q-1-16 6-30")}`,
  ),
  mk(
    "ufo",
    "Flying saucer",
    "จานบิน",
    170,
    120,
    `${die(pd(UFO_DOME, UFO_BEAM) + `<ellipse cx="85" cy="66" rx="66" ry="18"/>`)}
     ${p(UFO_BEAM, "#FFF1A8", 0)}${ln("M62 92h46M56 102h58", "#FFE066", 2.5)}
     ${p(UFO_DOME, "#BFE8F7", 0)}
     ${ln("M80 40L74 30M90 40L96 30", O, 2.5)}${ci(74, 30, 2.6, "#FF7AB6", 2)}${ci(96, 30, 2.6, "#FF7AB6", 2)}
     ${el(85, 50, 15, 13, "#8EE07A", 3)}
     ${eyes(85, 48, 5, 0.6)}${smile(85, 47, 0.6)}
     <path d="${UFO_DOME}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${gloss("M64 46q2-10 10-14", 3)}
     ${el(85, 66, 66, 18, "#9AA6C0")}
     ${el(85, 61, 52, 9, "#C9D2E3", 0)}
     ${[
       [34, 70, "#FFD23F"],
       [58, 76, "#FF7AB6"],
       [85, 79, "#FFD23F"],
       [112, 76, "#FF7AB6"],
       [136, 70, "#FFD23F"],
     ]
       .map(([x, y, c]) => ci(+x, +y, 4, `${c}`, 2))
       .join("")}`,
  ),
  mk(
    "astronaut-helmet",
    "Astronaut helmet",
    "หมวกนักบินอวกาศ",
    134,
    136,
    `${die(`<circle cx="67" cy="62" r="46"/><rect x="32" y="100" width="70" height="20" rx="8"/><rect x="16" y="50" width="12" height="26" rx="4"/><rect x="106" y="50" width="12" height="26" rx="4"/>`)}
     ${rc(32, 100, 70, 20, 8, "#C9D2DE")}${ln("M40 110h54", "#AEB8C8", 3)}${ci(84, 110, 4, "#E8453C", 2)}
     ${rc(16, 50, 12, 26, 4, "#FF8A3D")}${rc(106, 50, 12, 26, 4, "#FF8A3D")}
     ${ci(67, 62, 46, "#F4F6FA")}
     ${ln("M30 86Q67 112 104 86", "#D9DEE6", 5)}
     ${p(VISOR, "#2B3A67")}
     ${clip("c", `<path d="${VISOR}"/>`, `<circle cx="96" cy="84" r="16" fill="#3C4E86"/>${ci(86, 72, 5, "#FF8FB8", 0)}`)}
     <g fill="#fff"><circle cx="58" cy="70" r="1.4"/><circle cx="76" cy="46" r="1.2"/><circle cx="48" cy="76" r="1"/></g>
     ${p(spark(84, 56, 5), "#fff", 0)}
     ${ln("M42 54q4-10 14-13", "#fff", 4)}
     ${gloss("M34 34q8-10 18-12", 3.5)}`,
  ),
  mk(
    "saturn",
    "Ringed planet",
    "ดาวเสาร์",
    170,
    118,
    `${die(`<circle cx="85" cy="59" r="32"/><ellipse cx="85" cy="59" rx="69" ry="21" transform="rotate(-12 85 59)"/>` + pd(spark(26, 26, 7), spark(146, 96, 6)))}
     <g transform="rotate(-12 85 59)" fill="none"><ellipse cx="85" cy="59" rx="64" ry="16" stroke="${O}" stroke-width="11"/><ellipse cx="85" cy="59" rx="64" ry="16" stroke="#6FD3C7" stroke-width="5"/></g>
     ${ci(85, 59, 32, "#FFCF7A")}
     ${clip("c", `<circle cx="85" cy="59" r="32"/>`, `<rect x="40" y="40" width="90" height="7" fill="#F6A65A"/><rect x="40" y="56" width="90" height="5" fill="#FFE4A8"/><rect x="40" y="70" width="90" height="8" fill="#F6A65A"/>`)}
     <circle cx="85" cy="59" r="32" fill="none" stroke="${O}" stroke-width="${S}"/>
     ${gloss("M64 44q5-9 14-12")}
     <g transform="rotate(-12 85 59)" fill="none" stroke-linecap="round"><path d="M21 59A64 16 0 0 0 149 59" stroke="${O}" stroke-width="11"/><path d="M21 59A64 16 0 0 0 149 59" stroke="#6FD3C7" stroke-width="5"/><path d="M40 66A64 16 0 0 0 80 75" stroke="#fff" stroke-width="2" opacity=".8"/></g>
     ${p(spark(26, 26, 7), "#FFD23F", 2)}${p(spark(146, 96, 6), "#FF8FB8", 2)}`,
  ),
  mk(
    "comet",
    "Comet",
    "ดาวหาง",
    176,
    106,
    `${die(pd(COMET, spark(44, 88, 6), spark(80, 18, 5)) + `<circle cx="132" cy="52" r="24"/>`)}
     ${p(COMET, "#FF9EC7")}
     ${clip("c", `<path d="${COMET}"/>`, `<path d="M0 0H176V40Q100 34 0 44Z" fill="#7FD0F5"/><path d="M0 56Q100 50 176 58V106H0Z" fill="#FFD23F"/>`)}
     <path d="${COMET}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${ci(132, 52, 24, "#FFE07A")}
     ${ln("M112 64Q132 80 152 64", "#FFC94A", 5)}
     ${gloss("M116 42q4-8 12-10")}
     ${face(132, 52, 9, 0.9)}
     ${p(spark(44, 88, 6), "#FFD23F", 2)}${p(spark(80, 18, 5), "#7FD0F5", 2)}`,
  ),
  mk(
    "alien",
    "Little alien",
    "เอเลี่ยนตัวจิ๋ว",
    120,
    140,
    `${die(pd(A_HEAD, A_BODY) + sd("M46 28L40 16M74 28L80 16", 14) + `<circle cx="40" cy="16" r="4.5"/><circle cx="80" cy="16" r="4.5"/>` + sd("M42 104L28 112M78 104L92 112", 16))}
     ${ln("M46 28L40 16M74 28L80 16", O, 3)}${ci(40, 16, 4.5, "#FF7AB6", 2.5)}${ci(80, 16, 4.5, "#FF7AB6", 2.5)}
     ${tube("M42 104L28 112M78 104L92 112", "#8EE07A", 5)}
     ${p(A_BODY, "#8EE07A")}${el(60, 112, 10, 8, "#C9F2A8", 0)}
     ${p(A_HEAD, "#8EE07A")}
     ${el(44, 62, 8, 11, O, 0, 25)}${el(76, 62, 8, 11, O, 0, -25)}
     ${ci(46, 58, 2.6, "#fff", 0)}${ci(78, 58, 2.6, "#fff", 0)}
     <g fill="#FF8FA3" opacity=".75"><ellipse cx="34" cy="78" rx="5" ry="3"/><ellipse cx="86" cy="78" rx="5" ry="3"/></g>
     ${smile(60, 72, 0.8)}
     ${gloss("M30 50q4-14 16-20")}`,
  ),
];

// ---------------------------------------------------------------------------------------------
// Retro objects & treats
// ---------------------------------------------------------------------------------------------

const PAD = "M46 28H130C152 28 164 46 164 70C164 92 152 104 140 104C128 104 122 94 114 86H62C54 94 48 104 36 104C24 104 12 92 12 70C12 46 24 28 46 28Z";
const FLOPPY = "M16 22Q16 16 22 16H94L108 30V102Q108 108 102 108H22Q16 108 16 102Z";
const HP_BAND = "M24 80V68A51 51 0 0 1 126 68V80H112V68A37 37 0 0 0 38 68V80Z";
const BOOM_HANDLE = "M58 34V24Q58 16 66 16H120Q128 16 128 24V34H118V26H68V34Z";
const CONE = "M30 82L52 140L74 82Z";
const SCOOP = "M24 84C18 70 26 58 40 58C46 52 58 52 64 58C78 58 86 70 80 84Q70 90 60 86Q52 92 44 86Q34 90 24 84Z";
const SLICE = "M18 30Q65 14 112 30L70 132Q65 140 60 132Z";
const CRUST = "M18 30Q65 14 112 30L106 44Q65 30 24 44Z";
const BUN = "M22 58C22 34 44 20 75 20C106 20 128 34 128 58Q128 64 122 64H28Q22 64 22 58Z";
const LETTUCE = `M18 68${"q7-8 14 0".repeat(8)}q2 0 2 2V74H18Z`;
const CHEESE = "M24 70H126V76H110L104 86L98 76H42L36 84L30 76H24Z";
const BUN_BASE = "M24 96H126V100Q126 110 116 110H34Q24 110 24 100Z";
const NIGIRI_RICE = "M20 72C20 60 30 56 60 56C90 56 100 60 100 72C100 86 90 92 60 92C30 92 20 86 20 72Z";
const SALMON = "M16 60C18 46 36 40 62 42C88 44 104 52 104 62C96 68 80 70 60 70C36 70 22 68 16 60Z";
const POP = "M22 30Q22 14 45 14Q52 14 56 15A6 6 0 0 0 64 22A6 6 0 0 0 68 32V104Q68 110 62 110H28Q22 110 22 104Z";
const MUG = "M24 42H100V96Q100 112 84 112H40Q24 112 24 96Z";
const MUG_HANDLE = "M100 54H110Q124 54 124 70Q124 86 110 86H100V76H110Q114 76 114 70Q114 64 110 64H100Z";
const STEAM_HEART = "M62 32C52 24 52 14 58 14C61 14 62 17 62 18C62 17 63 14 66 14C72 14 72 24 62 32Z";
const LAPTOP_BASE = "M24 88H156L164 100Q164 106 158 106H22Q16 106 16 100Z";

const retro: LibrarySticker[] = [
  mk(
    "cassette",
    "Mixtape cassette",
    "เทปคาสเซ็ต",
    176,
    118,
    `${die(`<rect x="16" y="16" width="144" height="86" rx="12"/>`)}
     ${rc(16, 16, 144, 86, 12, "#FF7A6B")}
     ${rc(28, 26, 120, 44, 6, "#FFF4DC", 3)}
     ${ln("M34 32H142", "#FFD23F", 3)}${ln("M34 37H142", "#7FD0F5", 3)}
     ${text(88, 48, "MIX TAPE", 10, O, { font: MONO, weight: 800, tl: 58 })}
     ${rc(54, 52, 68, 16, 8, "#3A3340", 2.5)}
     ${rc(80, 56, 16, 8, 2, "#8B5A3C", 0)}
     ${[70, 106].map((x) => ci(x, 60, 6, "#fff", 2.5) + ln(`M${x - 3} 60h6M${x} 57v6`, O, 1.8)).join("")}
     ${p("M46 102L54 82H122L130 102Z", "#E85F50", 3)}
     ${ci(66, 94, 3, O, 0)}${ci(110, 94, 3, O, 0)}
     ${[
       [24, 24],
       [152, 24],
       [24, 94],
       [152, 94],
     ]
       .map(([x, y]) => ci(x, y, 2.5, "#FFD0C8", 1.5))
       .join("")}
     ${gloss("M22 44q0-10 4-14", 3)}`,
  ),
  mk(
    "game-controller",
    "Game controller",
    "จอยเกม",
    184,
    116,
    `<g transform="translate(4 0)">
       ${die(pd(PAD))}
       ${p(PAD, "#E9E4F5")}
       ${ln("M24 86Q30 98 40 100M152 86Q146 98 136 100", "#CFC6E8", 5)}
       ${rc(38, 48, 12, 28, 3, "#3A3340", 0)}${rc(30, 56, 28, 12, 3, "#3A3340", 0)}${ci(44, 62, 2.5, "#5A5470", 0)}
       ${ci(132, 50, 6, "#FF6B6B", 2.5)}${ci(144, 62, 6, "#4C8DFF", 2.5)}${ci(132, 74, 6, "#7AE582", 2.5)}${ci(120, 62, 6, "#FFD23F", 2.5)}
       ${rc(74, 50, 12, 5, 2.5, "#9A90B8", 0)}${rc(90, 50, 12, 5, 2.5, "#9A90B8", 0)}
       ${happy(88, 68, 8, 0.7)}
       ${gloss("M30 42q6-7 16-8", 3)}
     </g>`,
    "coding",
  ),
  mk(
    "floppy",
    "Floppy disk",
    "แผ่นดิสก์",
    124,
    124,
    `${die(pd(FLOPPY))}
     ${p(FLOPPY, "#4C8DFF")}
     ${rc(36, 16, 48, 32, 3, "#D9DEE6", 3)}${rc(66, 22, 10, 20, 2, "#4C8DFF", 0)}
     ${rc(28, 60, 68, 42, 4, "#FFF4DC", 3)}
     ${ln("M36 70H88M36 94H88", "#E3D5B8", 2)}
     ${text(62, 89, "SAVE", 17, "#E8453C", { tl: 52 })}
     ${rc(22, 96, 4, 6, 1, "#2E6FD8", 0)}
     ${gloss("M22 52V30", 3)}`,
    "coding",
  ),
  mk(
    "film-camera",
    "Film camera",
    "กล้องฟิล์ม",
    170,
    118,
    `${die(`<rect x="16" y="32" width="138" height="72" rx="12"/><rect x="118" y="22" width="18" height="12" rx="3"/>` + pd("M58 32L66 18H104L112 32Z"))}
     ${rc(118, 22, 18, 12, 3, "#E8453C", 3)}
     ${p("M58 32L66 18H104L112 32Z", "#3A3340")}
     ${rc(16, 32, 138, 72, 12, "#E9E4DA")}
     ${rc(18, 50, 134, 36, 0, "#C98F6B", 0)}
     ${rc(16, 32, 138, 72, 12, "none")}
     ${rc(26, 38, 24, 9, 3, "#FFF4DC", 2.5)}
     ${rc(120, 38, 20, 9, 3, "#2B3A67", 2.5)}
     ${ci(85, 68, 27, "#3A3340")}${ci(85, 68, 19, "#5A5470", 2.5)}${ci(85, 68, 11, "#7FD0F5", 2.5)}
     ${ci(81, 64, 3, "#fff", 0)}
     ${gloss("M24 58v20", 3)}`,
  ),
  mk(
    "headphones",
    "Headphones",
    "หูฟัง",
    156,
    136,
    `<g transform="translate(3 0)">
       ${die(pd(HP_BAND) + `<rect x="14" y="66" width="30" height="48" rx="13"/><rect x="106" y="66" width="30" height="48" rx="13"/>`)}
       ${p(HP_BAND, "#FF7AB6")}
       ${ln("M32 56A44 44 0 0 1 58 28", "#fff", 3)}
       ${rc(36, 72, 12, 36, 6, "#3A3340", 3)}${rc(102, 72, 12, 36, 6, "#3A3340", 3)}
       ${rc(14, 66, 30, 48, 13, "#8B7CF6")}${rc(106, 66, 30, 48, 13, "#8B7CF6")}
       ${ci(29, 90, 7, "#B3A8F9", 0)}${ci(121, 90, 7, "#B3A8F9", 0)}
       ${gloss("M21 78v10", 3)}
       ${tube("M72 72V50L90 46V68", "#FFD23F", 3)}
       ${el(68, 72, 5.5, 4.5, "#FFD23F", 3, -20)}${el(86, 68, 5.5, 4.5, "#FFD23F", 3, -20)}
     </g>`,
  ),
  mk(
    "vinyl",
    "Vinyl record",
    "แผ่นเสียง",
    160,
    132,
    `${die(`<rect x="14" y="24" width="90" height="90" rx="6"/><circle cx="102" cy="69" r="46"/>`)}
     ${ci(102, 69, 46, "#2B2320")}
     <g fill="none" stroke="#4A4048" stroke-width="2"><circle cx="102" cy="69" r="38"/><circle cx="102" cy="69" r="30"/><circle cx="102" cy="69" r="23"/></g>
     ${ci(102, 69, 15, "#FF6B6B", 2.5)}${ci(102, 69, 2.5, "#2B2320", 0)}
     ${ln("M118 34A38 38 0 0 1 136 52", "#fff", 3)}
     ${rc(14, 24, 90, 90, 6, "#FFB627")}
     ${ln("M24 96H94M24 104H94", "#FF8A3D", 4)}
     ${ci(59, 60, 20, "#FF6B6B", 3)}
     ${happy(59, 60, 7, 0.6)}
     ${gloss("M22 36h16", 3)}`,
  ),
  mk(
    "boombox",
    "Boombox",
    "วิทยุเทป",
    186,
    124,
    `${die(pd(BOOM_HANDLE) + `<rect x="16" y="32" width="154" height="80" rx="14"/>`)}
     ${p(BOOM_HANDLE, "#3A3340")}
     ${rc(16, 32, 154, 80, 14, "#4FC1B6")}
     ${rc(26, 40, 134, 8, 4, "#FFD23F", 2.5)}
     ${[54, 132].map((x) => ci(x, 80, 23, "#3A3340") + ci(x, 80, 14, "#5A5470", 2.5) + ci(x, 80, 5, "#8E9AAF", 2)).join("")}
     ${rc(80, 56, 26, 28, 4, "#CFEAF7", 3)}${ci(87, 70, 3, O, 0)}${ci(99, 70, 3, O, 0)}
     ${rc(81, 90, 6, 6, 1.5, "#FF6B6B", 2)}${rc(90, 90, 6, 6, 1.5, "#FFD23F", 2)}${rc(99, 90, 6, 6, 1.5, "#fff", 2)}
     ${gloss("M24 58v-6", 3)}`,
  ),
  mk(
    "polaroid",
    "Instant photo",
    "รูปโพลารอยด์",
    124,
    136,
    `<g transform="rotate(-6 62 71)">
       ${die(`<rect x="22" y="22" width="80" height="98" rx="4"/><rect x="48" y="16" width="28" height="12" rx="2"/>`)}
       ${rc(22, 22, 80, 98, 4, "#fff")}
       ${clip(
         "c",
         `<rect x="30" y="30" width="64" height="64"/>`,
         `<rect x="30" y="30" width="64" height="64" fill="#FFC9A8"/><circle cx="62" cy="72" r="13" fill="#FFD23F"/><rect x="30" y="72" width="64" height="22" fill="#4FB3E8"/>${ln("M52 80h20M56 86h12", "#fff", 2.5)}${ln("M40 44q3-3 6 0q3-3 6 0M72 40q2-2 4 0q2-2 4 0", O, 1.8)}`,
       )}
       ${rc(30, 30, 64, 64, 2, "none", 2.5)}
       ${ln("M38 106q6-4 12 0t12 0 12 0 12 0", "#8B7CF6", 2.5)}
       <rect x="48" y="16" width="28" height="12" rx="2" fill="#FFE08A" opacity=".9"/>
     </g>`,
  ),
  mk(
    "ice-cream",
    "Ice cream cone",
    "ไอศกรีมโคน",
    104,
    152,
    `${die(pd(CONE, SCOOP) + `<circle cx="52" cy="46" r="22"/><circle cx="58" cy="24" r="6"/>` + sd("M58 18q2-5 7-6", 12))}
     ${p(CONE, "#F2B866")}
     ${clip("c", `<path d="${CONE}"/>`, ln("M30 84l30 30M44 82l24 24M24 96l30 30M74 84l-30 30M62 82l-24 24M80 96l-30 30", "#D9963F", 2.5))}
     <path d="${CONE}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${p(SCOOP, "#9EE6C4")}
     ${ci(52, 46, 22, "#FF9EC7")}
     <g fill="#fff"><rect x="34" y="40" width="5" height="2.4" rx="1.2" transform="rotate(30 36 41)"/><rect x="66" y="36" width="5" height="2.4" rx="1.2" transform="rotate(-30 68 37)"/></g>
     <g fill="#FFD23F"><rect x="40" y="30" width="5" height="2.4" rx="1.2" transform="rotate(-20 42 31)"/><rect x="66" y="56" width="5" height="2.4" rx="1.2" transform="rotate(40 68 57)"/></g>
     ${ln("M58 18q2-5 7-6", O, 2.5)}${ci(58, 24, 6, "#E8392F", 3)}${ci(56, 22, 1.5, "#fff", 0)}
     ${gloss("M36 34q3-4 7-6", 3)}
     ${face(52, 48, 9, 0.85)}`,
  ),
  mk(
    "donut",
    "Sprinkle donut",
    "โดนัทโรยสี",
    130,
    130,
    `${die(`<circle cx="65" cy="65" r="48"/>`)}
     ${ci(65, 65, 48, "#E9B26F")}
     ${p(wavy(65, 65, 40, 3, 9), "#FF8FB8", 3)}
     ${ci(65, 65, 14, "#E9B26F", 3)}${ci(65, 65, 9, "#fff", 2.5)}
     ${[
       [42, 44, 30, "#FFD23F"],
       [60, 34, -20, "#7FD0F5"],
       [84, 40, 60, "#fff"],
       [92, 60, -40, "#7AE582"],
       [38, 66, 80, "#7FD0F5"],
       [86, 80, 20, "#FFD23F"],
       [44, 84, -30, "#fff"],
       [72, 48, 10, "#7AE582"],
     ]
       .map(([x, y, r, c]) => `<rect x="${+x - 4}" y="${+y - 1.5}" width="8" height="3" rx="1.5" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`)
       .join("")}
     ${gloss("M30 52q4-12 14-18")}
     ${face(65, 90, 8, 0.8)}`,
  ),
  mk(
    "pizza",
    "Pizza slice",
    "พิซซ่าชิ้นโต",
    130,
    146,
    `${die(pd(SLICE))}
     ${p(SLICE, "#FFD45C")}
     ${p(CRUST, "#E9A85A")}
     <g fill="#C9803A"><circle cx="40" cy="34" r="1.6"/><circle cx="65" cy="28" r="1.6"/><circle cx="90" cy="34" r="1.6"/></g>
     ${ci(42, 56, 8, "#E8453C", 3)}${ci(90, 58, 8, "#E8453C", 3)}${ci(66, 104, 7, "#E8453C", 3)}
     <g fill="#C9302A"><circle cx="40" cy="54" r="1.6"/><circle cx="92" cy="56" r="1.6"/><circle cx="64" cy="102" r="1.4"/></g>
     ${el(52, 92, 5, 3, "#5DBB63", 2, -30)}${el(82, 88, 5, 3, "#5DBB63", 2, 30)}
     ${face(66, 72, 9, 0.85)}`,
  ),
  mk(
    "burger",
    "Burger",
    "เบอร์เกอร์",
    150,
    122,
    `${die(pd(BUN, LETTUCE, BUN_BASE) + `<rect x="22" y="76" width="106" height="18" rx="9"/>`)}
     ${p(BUN_BASE, "#F4A949")}
     ${rc(22, 76, 106, 18, 9, "#7A4A2E")}${ln("M34 84h10M60 86h12M92 84h14", "#5C3520", 2.5)}
     ${p(CHEESE, "#FFD23F", 3)}
     ${p(LETTUCE, "#7ED957", 3)}
     ${p(BUN, "#F4A949")}
     ${ln("M30 56Q75 64 120 56", "#E08F2E", 4)}
     <g fill="#FFF4DC">${[
       [46, 32, -20],
       [64, 26, 0],
       [86, 26, 10],
       [104, 34, 30],
       [56, 40, 15],
       [96, 42, -15],
     ]
       .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.6" transform="rotate(${r} ${x} ${y})"/>`)
       .join("")}</g>
     ${gloss("M34 40q4-10 14-14")}
     ${face(75, 46, 12, 0.85)}`,
  ),
  mk(
    "sushi",
    "Sushi pair",
    "ซูชิ",
    170,
    110,
    `${die(pd(NIGIRI_RICE, SALMON) + `<circle cx="136" cy="70" r="22"/>`)}
     ${p(NIGIRI_RICE, "#FFFDF6")}
     <g fill="#EADFC8"><ellipse cx="36" cy="80" rx="2.6" ry="1.3"/><ellipse cx="84" cy="82" rx="2.6" ry="1.3"/></g>
     ${p(SALMON, "#FF8C69")}
     ${ln("M34 52Q44 60 40 66M54 48Q64 58 60 68M76 48Q86 58 82 68", "#FFD2C2", 3)}
     ${face(60, 76, 10, 0.75)}
     ${ci(136, 70, 22, "#2E3B33")}${ci(136, 70, 16, "#FFFDF6", 2.5)}
     ${ci(136, 70, 7, "#FF8C69", 2.5)}${rc(139, 64, 5, 5, 1, "#7ED957", 0)}
     ${gloss("M120 58q3-6 8-8", 3)}`,
  ),
  mk(
    "popsicle",
    "Popsicle",
    "ไอติมแท่ง",
    90,
    150,
    `${die(pd(POP) + `<rect x="38" y="106" width="14" height="32" rx="7"/>`)}
     ${rc(38, 106, 14, 32, 7, "#E3B47A", 3)}
     ${p(POP, "#FF7AB6")}
     ${clip("c", `<path d="${POP}"/>`, `<path d="M10 72L80 58V120H10Z" fill="#FFD23F"/><path d="M10 72L80 58" stroke="${O}" stroke-width="2.5"/>`)}
     <path d="${POP}" fill="none" stroke="${O}" stroke-width="${S}" stroke-linejoin="round"/>
     ${gloss("M30 30v24")}
     ${face(45, 84, 9, 0.85)}`,
  ),
  mk(
    "coffee-mug",
    "Coffee mug",
    "แก้วกาแฟ",
    140,
    124,
    `${die(pd(MUG, MUG_HANDLE, STEAM_HEART))}
     ${p(STEAM_HEART, "#FF7AB6", 2.5)}
     ${p(MUG_HANDLE, "#8BC5F0")}
     ${p(MUG, "#8BC5F0")}
     ${ln("M30 98Q62 112 94 98", "#6FAFDF", 5)}
     ${el(62, 42, 38, 7, "#6B4226", 3)}
     <g fill="#fff" opacity=".6"><circle cx="36" cy="60" r="2"/><circle cx="90" cy="64" r="2"/><circle cx="40" cy="96" r="2"/><circle cx="86" cy="96" r="2"/></g>
     ${gloss("M32 56v24")}
     ${face(62, 74, 12)}`,
  ),
  mk(
    "laptop",
    "Laptop",
    "แล็ปท็อป",
    180,
    124,
    `${die(`<rect x="38" y="16" width="104" height="72" rx="8"/>` + pd(LAPTOP_BASE))}
     ${rc(38, 16, 104, 72, 8, "#3A3340")}
     ${rc(46, 24, 88, 56, 3, "#1E2A3A", 0)}
     ${[
       [54, 32, 22, "#FF7AB6"],
       [80, 32, 30, "#7FD0F5"],
       [60, 42, 36, "#FFD23F"],
       [100, 42, 16, "#C9D2DE"],
       [60, 52, 24, "#7AE582"],
       [88, 52, 28, "#FF9F1C"],
       [54, 62, 14, "#FF7AB6"],
       [72, 62, 40, "#7FD0F5"],
       [54, 72, 10, "#C9D2DE"],
     ]
       .map(([x, y, w, c]) => rc(+x, +y, +w, 4, 2, `${c}`, 0))
       .join("")}
     ${rc(68, 70, 3, 7, 0, "#fff", 0)}
     ${p(LAPTOP_BASE, "#C9D2DE")}
     ${rc(76, 88, 28, 5, 2.5, "#9AA6B8", 0)}
     ${gloss("M44 30v12", 3)}`,
    "coding",
  ),
];

// ---------------------------------------------------------------------------------------------
// Words & badges
// ---------------------------------------------------------------------------------------------

const SU_BURST = star(70, 68, 52, 44, 16);
const MPR_CLOUD = `<circle cx="50" cy="64" r="28"/><circle cx="84" cy="48" r="30"/><circle cx="122" cy="52" r="28"/><circle cx="148" cy="68" r="24"/><rect x="30" y="58" width="140" height="40" rx="20"/>`;
const LOL = (attrs: string) =>
  `<text x="110" y="94" text-anchor="middle" textLength="150" lengthAdjust="spacingAndGlyphs" font-family="${BLACK}" font-weight="900" font-size="80" stroke-linejoin="round" paint-order="stroke" ${attrs}>555</text>`;
const OOPS_TAIL = "M40 66L30 94L66 70Z";
const CHILL = pill("ชิลๆ", {
  bg: "#7AE582",
  fg: O,
  font: TH,
  size: 30,
  tl: 66,
  iconW: 40,
  icon: `${ci(54, 41, 16, "#FFD23F", 3)}${rc(42, 34, 10, 8, 3, O, 0)}${rc(56, 34, 10, 8, 3, O, 0)}${ln("M52 37h4", O, 2)}${ln("M48 48q6 5 12 0", O, 2.6)}`,
});

const words: LibrarySticker[] = [
  mk(
    "su-su",
    "Fighting!",
    "สู้ๆ",
    140,
    136,
    `${die(pd(SU_BURST, spark(118, 112, 7), spark(22, 24, 6)))}
     ${p(SU_BURST, "#FF5A4E")}
     ${ci(70, 68, 38, "#FF7A59", 0)}
     ${gloss("M38 52q4-10 12-14")}
     ${text(70, 80, "สู้ๆ", 36, "#fff", { font: TH, tl: 66, stroke: O, sw: 6, weight: 800 })}
     ${p(spark(118, 112, 7), "#FFD23F", 2)}${p(spark(22, 24, 6), "#FFD23F", 2)}`,
  ),
  mk("chill", "Chill", "ชิลๆ", CHILL.w, CHILL.h, CHILL.body),
  mk(
    "mai-pen-rai",
    "No worries",
    "ไม่เป็นไร",
    190,
    112,
    `${die(MPR_CLOUD)}
     ${blob(MPR_CLOUD, "#DCEBFF")}
     ${ln("M44 94H156", "#C7DBFA", 5)}
     ${gloss("M66 34q8-8 18-9")}
     ${happy(96, 40, 7, 0.6)}
     ${text(98, 84, "ไม่เป็นไร", 26, "#3D5A99", { font: TH, tl: 112, weight: 800 })}`,
  ),
  mk(
    "555",
    "LOL (555)",
    "555",
    220,
    130,
    `${die(pd(drop(26, 44, 5), drop(200, 56, 5)))}
     <g transform="rotate(-6 110 70)">
       ${LOL('fill="#fff" stroke="#000" stroke-opacity=".13" stroke-width="36" transform="translate(0 4)"')}
       ${LOL('fill="#fff" stroke="#fff" stroke-width="34" transform="translate(0 4)"')}
       ${LOL('fill="#E5A800" stroke="#E5A800" stroke-width="12" transform="translate(0 5)"')}
       ${LOL(`fill="#FFD23F" stroke="${O}" stroke-width="12"`)}
     </g>
     ${p(drop(26, 44, 5), "#7FD0F5", 2.5)}${p(drop(200, 56, 5), "#7FD0F5", 2.5)}`,
  ),
  mk(
    "tired-but-ok",
    "Tired but okay",
    "เหนื่อยแต่ไหว",
    240,
    84,
    `${die(`<rect x="14" y="14" width="200" height="56" rx="14"/><rect x="210" y="28" width="16" height="28" rx="5"/>`)}
     ${rc(210, 28, 16, 28, 5, "#C9D2DE")}
     ${rc(14, 14, 200, 56, 14, "#FFF4DC")}
     ${rc(22, 22, 18, 40, 6, "#FF5A4E", 2.5)}
     ${gloss("M27 30v12", 2.5)}
     ${text(124, 52, "เหนื่อยแต่ไหว", 24, O, { font: TH, tl: 144, weight: 800 })}`,
  ),
  mk(
    "good-vibes",
    "Good vibes",
    "Good vibes",
    210,
    90,
    `${die(`<rect x="14" y="14" width="182" height="62" rx="31"/>`)}
     ${clip(
       "c",
       `<rect x="14" y="14" width="182" height="62" rx="31"/>`,
       ["#FF9EC7", "#FFC48A", "#FFE58A", "#A8EBC0", "#9FD3FF"]
         .map((c, i) => `<rect x="14" y="${14 + i * 12.4}" width="182" height="12.6" fill="${c}"/>`)
         .join(""),
     )}
     ${rc(14, 14, 182, 62, 31, "none")}
     ${text(105, 52, "GOOD VIBES", 19, "#fff", { tl: 140, stroke: O, sw: 6 })}
     ${p(spark(184, 26, 6), "#fff", 2)}${p(spark(28, 62, 5), "#fff", 2)}`,
  ),
  mk(
    "stay-curious",
    "Stay curious",
    "Stay curious",
    230,
    90,
    `${die(`<rect x="14" y="14" width="202" height="62" rx="16"/>`)}
     ${rc(14, 14, 202, 62, 16, "#8B7CF6")}
     ${tube("M55 53L64 62", "#3A3340", 5)}
     ${ci(46, 44, 13, "#CFEAF7")}
     ${text(46, 49, "?", 14, "#8B7CF6", { font: MONO, weight: 800 })}
     ${text(142, 51, "stay curious", 17, "#fff", { tl: 128 })}
     ${gloss("M24 26q4-4 12-4", 3)}`,
  ),
  mk(
    "hello",
    "Hello name tag",
    "ป้ายชื่อ Hello",
    180,
    124,
    `${die(`<rect x="14" y="14" width="152" height="96" rx="14"/>`)}
     ${rc(14, 14, 152, 96, 14, "#E8453C")}
     ${text(90, 43, "HELLO", 25, "#fff", { tl: 104 })}
     ${text(90, 56, "my name is", 10, "#fff", { font: MONO, weight: 700 })}
     ${rc(24, 62, 132, 40, 6, "#fff", 3)}
     ${ln("M40 86c8-14 14 6 22-6s14 10 22-2 12 8 22-4 10 6 20-2", "#4C8DFF", 3)}
     ${gloss("M24 30q2-8 10-9", 3)}`,
  ),
  mk(
    "oops",
    "Oops!",
    "อุ๊ปส์",
    170,
    110,
    `${die(`<rect x="14" y="14" width="142" height="58" rx="29"/>` + pd(OOPS_TAIL, drop(150, 24, 5)))}
     ${p(OOPS_TAIL, "#FFD23F")}
     ${rc(14, 14, 142, 58, 29, "#FFD23F")}
     ${ln("M38 66H60", "#FFD23F", 5)}
     ${gloss("M28 30q4-6 12-7", 3)}
     ${text(85, 54, "Oops!", 30, O, { tl: 100 })}
     ${p(drop(150, 24, 5), "#7FD0F5", 2.5)}`,
  ),
];

// ---------------------------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------------------------

const HEART = "M65 104C40 88 16 70 16 46C16 30 28 18 43 18C53 18 61 24 65 32C69 24 77 18 87 18C102 18 114 30 114 46C114 70 90 88 65 104Z";
const WOW = star(70, 70, 56, 36, 11, -80);
const CHECK = "M18 58L34 42L54 62L96 20L112 36L54 94Z";
const BIG_SPARK = (() => {
  const [x, y, r, k] = [64, 72, 46, 14.7];
  return `M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z`;
})();
const FINGERS = `<rect x="-9" y="-34" width="18" height="60" rx="9" transform="translate(48 60) rotate(-12)"/><rect x="-9" y="-34" width="18" height="60" rx="9" transform="translate(74 60) rotate(12)"/>`;
const PALM = `<rect x="28" y="72" width="64" height="54" rx="22"/>`;

const shapes: LibrarySticker[] = [
  mk(
    "heart",
    "Puffy heart",
    "หัวใจพองๆ",
    130,
    120,
    `${die(pd(HEART))}
     ${p(HEART, "#FF5D7A")}
     ${ln("M100 66C92 80 80 90 66 98", "#E8435F", 6)}
     ${gloss("M28 42q2-12 14-14")}
     ${face(65, 56, 12)}`,
  ),
  mk(
    "wow-burst",
    "WOW burst",
    "ว้าว!",
    140,
    140,
    `${die(pd(WOW))}
     ${p(WOW, "#FF7AB6")}
     ${p(star(70, 70, 44, 28, 11, -80), "#FFD23F", 0)}
     <g transform="rotate(-8 70 70)">${text(70, 80, "WOW!", 26, "#fff", { tl: 80, stroke: O, sw: 6 })}</g>`,
  ),
  mk(
    "checkmark",
    "Done check",
    "เสร็จแล้ว",
    130,
    110,
    `${die(pd(CHECK, spark(112, 86, 7)))}
     ${p(CHECK, "#3DD68C")}
     ${ln("M36 58l18 18 44-44", "#2FB874", 4)}
     ${gloss("M26 57l8-8", 3)}${gloss("M92 30l5-5", 3)}
     ${happy(54, 76, 5, 0.55)}
     ${p(spark(112, 86, 7), "#FFD23F", 2)}`,
  ),
  mk(
    "sparkle",
    "Holo sparkle",
    "ประกายวิ้ง",
    136,
    140,
    `${die(pd(BIG_SPARK, spark(108, 32, 13), spark(28, 116, 8)))}
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB3E6"/><stop offset=".5" stop-color="#B3D9FF"/><stop offset="1" stop-color="#C9FFD9"/></linearGradient></defs>
     ${p(BIG_SPARK, "url(#g)")}
     ${p(spark(108, 32, 13), "#FFD23F", 3)}${p(spark(28, 116, 8), "#B3D9FF", 2.5)}
     ${gloss("M60 42l-2 12", 3)}
     ${face(64, 72, 6, 0.7)}`,
  ),
  mk(
    "smiley",
    "Big smiley",
    "หน้ายิ้ม",
    124,
    124,
    `${die(`<circle cx="62" cy="62" r="46"/>`)}
     ${ci(62, 62, 46, "#FFD23F")}
     ${ln("M30 86Q62 116 94 86", "#FFC21A", 6)}
     ${el(46, 50, 6, 10, O, 0)}${el(78, 50, 6, 10, O, 0)}
     ${ci(48, 46, 2.2, "#fff", 0)}${ci(80, 46, 2.2, "#fff", 0)}
     ${p("M36 70Q62 102 88 70Z", O, 3)}
     ${p("M50 86Q62 78 74 86Q62 94 50 86Z", "#FF6F86", 0)}
     <g fill="#FF8FA3" opacity=".75"><ellipse cx="32" cy="66" rx="6" ry="3.5"/><ellipse cx="92" cy="66" rx="6" ry="3.5"/></g>
     ${gloss("M30 46q4-14 18-20")}`,
  ),
  mk(
    "peace-hand",
    "Peace sign hand",
    "มือชูสองนิ้ว",
    120,
    150,
    `${die(FINGERS + PALM + `<rect x="36" y="120" width="48" height="20" rx="5"/>`)}
     ${blob(FINGERS + PALM, "#FFCF8A")}
     ${rc(58, 80, 34, 15, 7.5, "#FFCF8A", 3)}${rc(58, 94, 32, 15, 7.5, "#FFCF8A", 3)}
     <g transform="rotate(-18 50 102)">${rc(28, 96, 40, 16, 8, "#FFCF8A", 3)}</g>
     ${gloss("M40 30l-2 12", 3)}${gloss("M76 28l2 12", 3)}
     ${rc(36, 120, 48, 20, 5, "#7FD0F5")}${ln("M42 130h36", "#5DB4E0", 3)}`,
  ),
];

/** The pack's themed sections, in order; the editor's category chips are derived from them. */
export const PACK_2_SECTIONS = { food, culture, animals, nature, space, retro, words, shapes };

export const PACK_2: LibrarySticker[] = Object.values(PACK_2_SECTIONS).flat();
