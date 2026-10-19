import { BLACK, MONO, O, die, gloss, wrap } from "./art";
import type { LibrarySticker } from "./library";

/**
 * DEMO-ONLY programming-language logo stickers, redrawn in-house as simplified SVG.
 * Most language logos are trademarks of their foundations/companies, so these are listed only
 * when DEMO_ASSETS is on. Clear each project's trademark policy before shipping them publicly.
 * The gopher is inspired by the Go gopher by Renée French (CC BY 4.0); Ferris is public domain.
 */

const SANS = "Helvetica Neue, Helvetica, Arial, sans-serif";
const MM = 0.36;

const logo = (id: string, name: string, w: number, h: number, body: string): LibrarySticker => ({
  id: `lang-${id}`,
  category: "coding",
  name: { en: name, th: name },
  widthMm: Math.round(w * MM),
  viewBox: [w, h],
  svg: wrap(w, h, body),
  demo: true,
});

/** Diagonal vinyl sheen clipped to `shape` (plain shape markup). */
const sheen = (shape: string, w = 120) =>
  `<clipPath id="sh">${shape}</clipPath><path d="M0 0H${w}L0 ${w * 0.62}Z" fill="#fff" opacity=".16" clip-path="url(#sh)"/>`;

/** A point on a circle as "x y". */
const polar = (cx: number, cy: number, r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;

/* ---------- Shared shapes ---------- */

/** Rounded square badge with a sheen. */
const square = (fill: string, inner: string, rx = 12) => {
  const shape = `<rect x="12" y="12" width="86" height="86" rx="${rx}"/>`;
  return `${die(shape)}<rect x="12" y="12" width="86" height="86" rx="${rx}" fill="${fill}"/>${inner}${sheen(shape)}`;
};

/** Pointy-top hexagon split into three shaded faces, like the C-family logos. */
const HEX = "M55 8L96 31.5V78.5L55 102L14 78.5V31.5Z";
const hex = (top: string, mid: string, low: string, inner: string) =>
  `${die(`<path d="${HEX}"/>`)}
   <path d="${HEX}" fill="${mid}"/>
   <path d="M14 31.5L55 8L96 31.5L55 55Z" fill="${top}"/>
   <path d="M96 31.5V78.5L55 102V55Z" fill="${low}"/>
   ${inner}${sheen(`<path d="${HEX}"/>`)}`;

/** White "C" ring with its opening facing right. */
const cRing = (cx: number, r: number, w: number) => {
  const c = 2 * Math.PI * r;
  const gap = c * 0.25;
  return `<circle cx="${cx}" cy="55" r="${r}" fill="none" stroke="#fff" stroke-width="${w}" stroke-dasharray="${(c - gap).toFixed(1)} ${gap.toFixed(1)}" stroke-dashoffset="${(-gap / 2).toFixed(1)}"/>`;
};
const plus = (x: number, y: number, s: number) =>
  `<path d="M${x - s} ${y}h${s * 2}M${x} ${y - s}v${s * 2}" stroke="#fff" stroke-width="${s * 0.62}" stroke-linecap="square"/>`;

/** HTML5 / CSS3 shield. */
const SHIELD = "M17 12H93L86 89L55 98L24 89Z";
const shield = (dark: string, light: string, digit: string, word: string) =>
  `${die(`<path d="${SHIELD}"/>`)}
   <path d="${SHIELD}" fill="${dark}"/><path d="M55 18H87L81 84L55 91.5Z" fill="${light}"/>
   <text x="55" y="37" text-anchor="middle" font-family="${BLACK}" font-weight="900" font-size="14" fill="#fff" letter-spacing="1">${word}</text>
   <text x="55" y="81" text-anchor="middle" font-family="${BLACK}" font-weight="900" font-size="42" fill="#fff">${digit}</text>
   <path d="M30 44H80" stroke="#fff" stroke-width="2.5" opacity=".35" stroke-linecap="round"/>
   ${sheen(`<path d="${SHIELD}"/>`)}`;

/* ---------- Marks that need real paths ---------- */

const PY =
  "M54 13c-21 0-19.6 9.1-19.6 9.1V31.5h20V34.4H26.4S13 32.9 13 54s11.7 20.4 11.7 20.4h7V64.6s-.4-11.7 11.5-11.7h19.8s11.2.2 11.2-10.8V24.3S76 13 54 13z";

const SWIFT_BIRD =
  "M22 67C39 80 62 83 77 72C83 76 87 80 89 87C92 75 88 64 81 58C86 42 77 25 60 15C68 28 70 41 66 51C55 42 42 32 31 23C39 34 47 42 55 49C45 43 35 37 27 30C37 46 49 57 62 64C50 70 36 71 22 67Z";

const RUST_GEAR = (() => {
  const pts: string[] = [];
  const step = (2 * Math.PI) / 32;
  for (let i = 0; i < 32; i++) {
    const a = i * step;
    pts.push(polar(60, 60, 43, a - 0.38 * step), polar(60, 60, 50, a - 0.14 * step), polar(60, 60, 50, a + 0.14 * step), polar(60, 60, 43, a + 0.38 * step));
  }
  return `M${pts.join("L")}Z`;
})();
const RUST_HOLES = Array.from({ length: 5 }, (_, i) => {
  const [x, y] = polar(60, 60, 38.5, -Math.PI / 2 + (i * 2 * Math.PI) / 5).split(" ");
  return `<circle cx="${x}" cy="${y}" r="3" fill="#F5EFE6"/>`;
}).join("");

const GOPHER_ARMS = "M28 70C20 72 18 82 24 84M92 70C100 72 102 82 96 84";
const FERRIS_CLAWS = "M28 56C14 52 10 38 18 30C22 40 28 42 34 44M122 56C136 52 140 38 132 30C128 40 122 42 116 44";

export const LANG_LOGOS: LibrarySticker[] = [
  logo(
    "javascript",
    "JavaScript",
    110,
    110,
    square(
      "#F7DF1E",
      `<text x="89" y="89" text-anchor="end" font-family="${SANS}" font-weight="800" font-size="42" letter-spacing="-1" fill="#1B1B1F">JS</text>`,
      8,
    ),
  ),
  logo(
    "typescript",
    "TypeScript",
    110,
    110,
    square(
      "#3178C6",
      `<text x="89" y="89" text-anchor="end" font-family="${SANS}" font-weight="800" font-size="42" letter-spacing="-1" fill="#fff">TS</text>`,
      10,
    ),
  ),
  logo(
    "python",
    "Python",
    110,
    110,
    `${die(`<path d="${PY}"/><path d="${PY}" transform="rotate(180 55 55)"/>`)}
     <defs>
       <linearGradient id="pb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5A9FD4"/><stop offset="1" stop-color="#306998"/></linearGradient>
       <linearGradient id="py" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFD43B"/><stop offset="1" stop-color="#FFE873"/></linearGradient>
     </defs>
     <path d="${PY}" fill="url(#pb)"/><path d="${PY}" fill="url(#py)" transform="rotate(180 55 55)"/>
     <circle cx="43" cy="22" r="3.6" fill="#fff"/><circle cx="67" cy="88" r="3.6" fill="#fff"/>`,
  ),
  logo(
    "go",
    "Go gopher",
    120,
    120,
    `${die(`<circle cx="31" cy="26" r="9"/><circle cx="89" cy="26" r="9"/><path d="M28 44C28 16 92 16 92 44V96C92 112 28 112 28 96Z"/><path d="${GOPHER_ARMS}" fill="none" stroke-width="20"/>`)}
     <g fill="#6AD7E5" stroke="${O}" stroke-width="3"><circle cx="31" cy="26" r="9"/><circle cx="89" cy="26" r="9"/></g>
     <path d="${GOPHER_ARMS}" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/>
     <path d="${GOPHER_ARMS}" fill="none" stroke="#F6D2A2" stroke-width="3.5" stroke-linecap="round"/>
     <path d="M28 44C28 16 92 16 92 44V96C92 112 28 112 28 96Z" fill="#6AD7E5" stroke="${O}" stroke-width="3.5"/>
     <path d="M34 92C40 104 80 104 86 92" stroke="#4FC3D3" stroke-width="5" fill="none" stroke-linecap="round"/>
     <g fill="#fff" stroke="${O}" stroke-width="3"><circle cx="45" cy="45" r="13"/><circle cx="75" cy="45" r="13"/></g>
     <g fill="${O}"><circle cx="48" cy="47" r="5"/><circle cx="78" cy="47" r="5"/></g>
     <g fill="#fff"><circle cx="49.6" cy="45.2" r="1.7"/><circle cx="79.6" cy="45.2" r="1.7"/></g>
     <ellipse cx="60" cy="65" rx="11" ry="8" fill="#F6D2A2" stroke="${O}" stroke-width="2.5"/>
     <ellipse cx="60" cy="60" rx="5.5" ry="3.8" fill="${O}"/>
     <path d="M56 70h8v7a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 56 77z" fill="#fff" stroke="${O}" stroke-width="2"/><path d="M60 70v8" stroke="${O}" stroke-width="1.5"/>
     ${gloss("M38 26q8-6 18-6", 3.5)}`,
  ),
  logo(
    "go-wordmark",
    "Go",
    150,
    80,
    `${die(`<rect x="10" y="10" width="130" height="60" rx="16"/>`)}
     <rect x="10" y="10" width="130" height="60" rx="16" fill="#00ADD8"/>
     <g stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M24 31h22M17 40h26M27 49h16"/></g>
     <text x="93" y="56" text-anchor="middle" font-family="${SANS}" font-weight="900" font-style="italic" font-size="38" fill="#fff" letter-spacing="2">GO</text>
     ${sheen(`<rect x="10" y="10" width="130" height="60" rx="16"/>`, 150)}`,
  ),
  logo(
    "rust",
    "Rust",
    120,
    120,
    `${die(`<circle cx="60" cy="60" r="49"/>`)}
     <path d="${RUST_GEAR}" fill="#1B1B1F" stroke="#1B1B1F" stroke-width="1.5" stroke-linejoin="round"/>
     ${RUST_HOLES}
     <circle cx="60" cy="60" r="33" fill="#F5EFE6"/>
     <path d="M42 44H66C78 44 82 50 82 56C82 61 79 64 74 66C78 68 79 71 79 75V80H68V76C68 72 66 70 62 70H54V80H42ZM54 53V61H64C68 61 70 59 70 57C70 55 68 53 64 53Z" fill="#1B1B1F" fill-rule="evenodd"/>`,
  ),
  logo(
    "ferris",
    "Ferris (Rust)",
    150,
    104,
    `${die(`<path d="M28 62C28 44 50 34 75 34C100 34 122 44 122 62C122 80 100 90 75 90C50 90 28 80 28 62Z"/><path d="${FERRIS_CLAWS}" fill="none" stroke-width="20"/><path d="M64 36V22M86 36V22" fill="none" stroke-width="16"/><circle cx="64" cy="20" r="7"/><circle cx="86" cy="20" r="7"/><path d="M44 84L36 96M58 89L54 99M92 89L96 99M106 84L114 96" fill="none" stroke-width="16"/>`)}
     <g fill="none" stroke-linecap="round"><path d="M64 36V22M86 36V22" stroke="${O}" stroke-width="7"/><path d="M64 36V22M86 36V22" stroke="#F74C00" stroke-width="2.5"/></g>
     <g fill="#fff" stroke="${O}" stroke-width="2.5"><circle cx="64" cy="20" r="7"/><circle cx="86" cy="20" r="7"/></g>
     <g fill="${O}"><circle cx="65" cy="21" r="3.5"/><circle cx="87" cy="21" r="3.5"/></g>
     <g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${FERRIS_CLAWS}" stroke="${O}" stroke-width="10"/><path d="${FERRIS_CLAWS}" stroke="#F74C00" stroke-width="4.5"/></g>
     <g stroke="${O}" stroke-width="4" stroke-linecap="round"><path d="M44 84L36 96M58 89L54 99M92 89L96 99M106 84L114 96"/></g>
     <path d="M28 62C28 52 34 44 42 40L50 32L56 38L64 32L72 37L80 31L88 37L96 32L102 38L108 34L110 42C118 46 122 54 122 62C122 80 100 90 75 90C50 90 28 80 28 62Z" fill="#F74C00" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
     <path d="M38 76C50 86 100 86 112 76" stroke="#D63F00" stroke-width="5" fill="none" stroke-linecap="round"/>
     <path d="M68 62q7 6 14 0" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>
     <g fill="#FF9FB2" opacity=".75"><ellipse cx="56" cy="62" rx="5" ry="3"/><ellipse cx="94" cy="62" rx="5" ry="3"/></g>
     ${gloss("M44 50q8-6 18-8", 3.5)}`,
  ),
  logo(
    "java",
    "Java",
    110,
    122,
    `${die(`<path d="M24 56h54v10c0 18-12 28-27 28S24 84 24 66z"/><path d="M78 62c13-2 15 15 0 17" fill="none" stroke-width="18"/><path d="M45 50c-9-9 9-14 1-27M60 50c-9-9 9-14 1-27" fill="none" stroke-width="17"/><ellipse cx="51" cy="96" rx="34" ry="6"/><rect x="22" y="100" width="58" height="17" rx="8.5"/>`)}
     <path d="M45 50c-9-9 9-14 1-27M60 50c-9-9 9-14 1-27" stroke="#E76F00" stroke-width="5" fill="none" stroke-linecap="round"/>
     <ellipse cx="51" cy="95" rx="33" ry="5" fill="#5382A1" opacity=".55"/>
     <path d="M78 62c13-2 15 15 0 17" stroke="#5382A1" stroke-width="5" fill="none" stroke-linecap="round"/>
     <path d="M24 56h54v10c0 18-12 28-27 28S24 84 24 66z" fill="#5382A1"/>
     <path d="M30 63h42" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".45"/>
     <text x="51" y="114" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="15" fill="#E76F00">Java</text>`,
  ),
  logo("c", "C", 110, 110, hex("#A8B9CC", "#5C6BC0", "#283593", cRing(55, 21, 11))),
  logo("cpp", "C++", 110, 110, hex("#659AD2", "#00599C", "#004482", `${cRing(45, 18, 10)}${plus(71, 55, 6)}${plus(86, 55, 6)}`)),
  logo(
    "csharp",
    "C#",
    110,
    110,
    hex(
      "#9B4F96",
      "#68217A",
      "#4E1A5C",
      `${cRing(45, 18, 10)}<g stroke="#fff" stroke-width="3.6" stroke-linecap="square"><path d="M72 48h18M72 62h18M77 42l-2 26M87 42l-2 26"/></g>`,
    ),
  ),
  logo(
    "swift",
    "Swift",
    110,
    110,
    `${die(`<rect x="12" y="12" width="86" height="86" rx="24"/>`)}
     <defs><linearGradient id="sw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F88A36"/><stop offset="1" stop-color="#FD2020"/></linearGradient></defs>
     <rect x="12" y="12" width="86" height="86" rx="24" fill="url(#sw)"/>
     <path d="${SWIFT_BIRD}" fill="#fff"/>
     ${sheen(`<rect x="12" y="12" width="86" height="86" rx="24"/>`)}`,
  ),
  logo(
    "kotlin",
    "Kotlin",
    110,
    110,
    `${die(`<path d="M16 16H94L55 55L94 94H16Z"/>`)}
     <defs><linearGradient id="k" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#E44857"/><stop offset=".47" stop-color="#C711E1"/><stop offset="1" stop-color="#7F52FF"/></linearGradient></defs>
     <path d="M16 16H94L55 55L94 94H16Z" fill="url(#k)"/>
     ${sheen(`<path d="M16 16H94L55 55L94 94H16Z"/>`)}`,
  ),
  logo(
    "php",
    "PHP",
    140,
    86,
    `${die(`<ellipse cx="70" cy="43" rx="58" ry="31"/>`)}
     <ellipse cx="70" cy="43" rx="58" ry="31" fill="#777BB4"/>
     <ellipse cx="70" cy="43" rx="53" ry="26.5" fill="none" stroke="#fff" stroke-width="1.6" opacity=".35"/>
     <text x="70" y="56" text-anchor="middle" font-family="${SANS}" font-weight="900" font-style="italic" font-size="37" fill="#1B1B1F" opacity=".25" transform="translate(1.5 2)">php</text>
     <text x="70" y="56" text-anchor="middle" font-family="${SANS}" font-weight="900" font-style="italic" font-size="37" fill="#fff">php</text>
     ${sheen(`<ellipse cx="70" cy="43" rx="58" ry="31"/>`, 140)}`,
  ),
  logo(
    "ruby",
    "Ruby",
    110,
    104,
    `${die(`<path d="M26 16H84L100 40L55 94L10 40Z"/>`)}
     <path d="M26 16H84L100 40L55 94L10 40Z" fill="#CC342D"/>
     <path d="M40 16H70L78 40H32Z" fill="#F27D73"/>
     <path d="M26 16H40L32 40H10Z" fill="#E0544B"/><path d="M70 16H84L100 40H78Z" fill="#C33A31"/>
     <path d="M10 40H32L55 94Z" fill="#E0544B"/><path d="M32 40H78L55 94Z" fill="#CC342D"/><path d="M78 40H100L55 94Z" fill="#8B1610"/>
     <path d="M10 40H100M32 40L55 94L78 40M40 16L32 40M70 16L78 40" stroke="#7A120D" stroke-width="1.2" fill="none" opacity=".5"/>
     ${gloss("M36 22l-3 10", 3)}${gloss("M48 46l5 26", 2.5)}`,
  ),
  logo("html", "HTML5", 110, 110, shield("#E34F26", "#F06529", "5", "HTML")),
  logo("css", "CSS3", 110, 110, shield("#1572B6", "#33A9DC", "3", "CSS")),
  logo(
    "bash",
    "Bash",
    110,
    110,
    hex(
      "#4EAA25",
      "#293138",
      "#1B2126",
      `<text x="55" y="68" text-anchor="middle" font-family="${MONO}" font-weight="800" font-size="36" fill="#fff">$_</text>`,
    ),
  ),
  logo(
    "sql",
    "SQL",
    100,
    120,
    `${die(`<path d="M18 28v64a32 10 0 0 0 64 0V28z"/><ellipse cx="50" cy="28" rx="32" ry="10"/>`)}
     <path d="M18 28v64a32 10 0 0 0 64 0V28" fill="#336791"/>
     <path d="M18 50a32 10 0 0 0 64 0M18 72a32 10 0 0 0 64 0" stroke="#24506F" stroke-width="2.5" fill="none"/>
     <ellipse cx="50" cy="28" rx="32" ry="10" fill="#6A9BC3"/>
     <text x="50" y="79" text-anchor="middle" font-family="${BLACK}" font-weight="900" font-size="20" fill="#fff">SQL</text>
     ${sheen(`<path d="M18 28v64a32 10 0 0 0 64 0V28z"/>`, 100)}`,
  ),
  logo(
    "lua",
    "Lua",
    116,
    116,
    `${die(`<circle cx="52" cy="62" r="40"/><circle cx="92" cy="22" r="10"/>`)}
     <circle cx="56" cy="58" r="50" fill="none" stroke="#9AA4B2" stroke-width="1.6" stroke-dasharray="3 5" opacity=".9"/>
     <circle cx="52" cy="62" r="40" fill="#000080"/><circle cx="66" cy="48" r="10.5" fill="#fff"/><circle cx="92" cy="22" r="10" fill="#000080"/>
     <text x="48" y="82" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="26" fill="#fff">Lua</text>
     ${sheen(`<circle cx="52" cy="62" r="40"/>`)}`,
  ),
  logo(
    "r",
    "R",
    130,
    100,
    `${die(`<ellipse cx="62" cy="46" rx="50" ry="34"/><path d="M58 30h32c14 0 18 20 4 26l14 32H88L76 60H72V88H58Z"/>`)}
     <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CBCED0"/><stop offset="1" stop-color="#84838B"/></linearGradient></defs>
     <ellipse cx="62" cy="46" rx="50" ry="34" fill="url(#rg)"/><ellipse cx="66" cy="50" rx="36" ry="22" fill="#fff"/>
     <path d="M58 30h32c14 0 18 20 4 26l14 32H88L76 60H72V88H58Z" fill="#276DC3"/><path d="M72 40h14c5 0 5 10 0 10H72Z" fill="#fff"/>`,
  ),
  logo(
    "haskell",
    "Haskell",
    150,
    100,
    `${die(`<path d="M12 90L34 50L12 10H28L50 50L28 90Z"/><path d="M34 90L56 50L34 10H50L94 90H78L64 65L50 90Z"/><path d="M86 34H138V46H86ZM86 54H138V66H86Z"/>`)}
     <path d="M12 90L34 50L12 10H28L50 50L28 90Z" fill="#453A62"/>
     <path d="M34 90L56 50L34 10H50L94 90H78L64 65L50 90Z" fill="#5E5086"/>
     <path d="M92 34H138V46H98ZM103 54H138V66H109Z" fill="#8F4E8B"/>`,
  ),
  logo(
    "elixir",
    "Elixir",
    100,
    120,
    `${die(`<path d="M50 10C70 34 84 58 84 78A34 34 0 0 1 16 78C16 54 34 30 50 10Z"/>`)}
     <defs><linearGradient id="e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9C8E5"/><stop offset=".45" stop-color="#8D67AF"/><stop offset="1" stop-color="#4B275F"/></linearGradient></defs>
     <path d="M50 10C70 34 84 58 84 78A34 34 0 0 1 16 78C16 54 34 30 50 10Z" fill="url(#e)"/>
     <path d="M58 30C66 46 72 62 70 80C68 96 54 104 42 102C56 96 62 84 62 70C62 56 58 44 58 30Z" fill="#4B275F" opacity=".35"/>
     ${gloss("M38 44q-8 14-8 28", 4)}`,
  ),
  logo(
    "node",
    "Node.js",
    110,
    110,
    hex(
      "#8CC84B",
      "#3C873A",
      "#2D6A2B",
      `<text x="55" y="64" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="25" fill="#fff">node</text>`,
    ),
  ),
  logo(
    "dart",
    "Dart",
    110,
    110,
    `${die(`<path d="M26 32L54 14L96 56V94H58L26 62Z"/>`)}
     <path d="M26 32L54 14L96 56V94H58L26 62Z" fill="#0175C2"/>
     <path d="M26 32L54 14L96 56H64Z" fill="#13B9FD"/>
     <path d="M26 32L64 56V94H58L26 62Z" fill="#02569B"/>
     ${sheen(`<path d="M26 32L54 14L96 56V94H58L26 62Z"/>`)}`,
  ),
  logo(
    "scala",
    "Scala",
    100,
    120,
    `${die(`<path d="M24 16L76 26V100L24 90Z"/>`)}
     <path d="M24 16L76 26V100L24 90Z" fill="#7F0C1D"/>
     ${[0, 26, 52].map((y) => `<path d="M24 ${16 + y}L76 ${26 + y}V${44 + y}L24 ${34 + y}Z" fill="#DC322F"/><path d="M24 ${16 + y}L76 ${26 + y}V${31 + y}L24 ${21 + y}Z" fill="#F15A5A"/>`).join("")}`,
  ),
  logo(
    "zig",
    "Zig",
    110,
    110,
    square(
      "#F7A41D",
      `<path d="M30 30H82L48 72H80L76 82H28L62 40H34Z" fill="#fff"/><path d="M20 30h6M84 82h6" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
      16,
    ),
  ),
  logo(
    "react",
    "React",
    120,
    120,
    `${die(`<circle cx="60" cy="60" r="48"/>`)}
     <circle cx="60" cy="60" r="48" fill="#20232A"/>
     <g fill="none" stroke="#61DAFB" stroke-width="4">${[0, 60, 120].map((a) => `<ellipse cx="60" cy="60" rx="38" ry="14" transform="rotate(${a} 60 60)"/>`).join("")}</g>
     <circle cx="60" cy="60" r="7" fill="#61DAFB"/>
     ${sheen(`<circle cx="60" cy="60" r="48"/>`)}`,
  ),
  logo(
    "vue",
    "Vue",
    120,
    104,
    `${die(`<path d="M14 14H106L60 94Z"/>`)}
     <path d="M14 14H38L60 52L82 14H106L60 94Z" fill="#41B883"/>
     <path d="M38 14H53L60 26L67 14H82L60 52Z" fill="#34495E"/>`,
  ),
  logo(
    "angular",
    "Angular",
    110,
    116,
    `${die(`<path d="M55 10L96 25L90 84L55 104L20 84L14 25Z"/>`)}
     <path d="M55 10L96 25L90 84L55 104L20 84L14 25Z" fill="#DD0031"/>
     <path d="M55 10L96 25L90 84L55 104Z" fill="#C3002F"/>
     <path d="M55 24L31 82H41L46 69H64L69 82H79ZM55 43L61 60H49Z" fill="#fff" fill-rule="evenodd"/>
     ${sheen(`<path d="M55 10L96 25L90 84L55 104L20 84L14 25Z"/>`)}`,
  ),
  logo(
    "svelte",
    "Svelte",
    110,
    120,
    `${die(`<path d="M72 28C62 18 42 20 36 32C30 44 40 52 55 58C70 64 78 72 72 84C66 96 46 98 36 88" fill="none" stroke-width="30"/>`)}
     <path d="M72 28C62 18 42 20 36 32C30 44 40 52 55 58C70 64 78 72 72 84C66 96 46 98 36 88" fill="none" stroke="#FF3E00" stroke-width="18" stroke-linecap="round"/>
     <path d="M72 28C62 18 42 20 36 32C30 44 40 52 55 58C70 64 78 72 72 84C66 96 46 98 36 88" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  ),
  logo(
    "nextjs",
    "Next.js",
    110,
    110,
    `${die(`<circle cx="55" cy="55" r="43"/>`)}
     <defs><linearGradient id="nx" gradientUnits="userSpaceOnUse" x1="41" y1="36" x2="78" y2="86"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
     <circle cx="55" cy="55" r="43" fill="#000"/>
     <path d="M41 36V74" stroke="#fff" stroke-width="6.5"/>
     <path d="M41 36L78 86" stroke="url(#nx)" stroke-width="6.5"/>
     <path d="M70 36V62" stroke="#fff" stroke-width="6.5"/>`,
  ),
  logo(
    "tailwind",
    "Tailwind CSS",
    140,
    90,
    `${die(`<rect x="10" y="10" width="120" height="70" rx="22"/>`)}
     <rect x="10" y="10" width="120" height="70" rx="22" fill="#0F172A"/>
     <path transform="translate(25 13) scale(1.67)" fill="#38BDF8" d="M27 0C19.8 0 15.3 3.6 13.5 10.8c2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z"/>
     ${sheen(`<rect x="10" y="10" width="120" height="70" rx="22"/>`, 140)}`,
  ),
  logo(
    "docker",
    "Docker",
    150,
    110,
    `${die(`<path d="M14 60H120C124 50 132 47 139 50C137 58 131 62 125 62C119 86 93 100 63 100C35 100 18 84 14 60Z"/><rect x="28" y="44" width="72" height="16"/><rect x="56" y="30" width="30" height="14"/><rect x="70" y="16" width="16" height="14"/>`)}
     <path d="M14 60H120C124 50 132 47 139 50C137 58 131 62 125 62C119 86 93 100 63 100C35 100 18 84 14 60Z" fill="#2496ED"/>
     <g fill="#2496ED" stroke="#fff" stroke-width="2.2">${[30, 44, 58, 72, 86].map((x) => `<rect x="${x}" y="46" width="12" height="12"/>`).join("")}${[58, 72].map((x) => `<rect x="${x}" y="32" width="12" height="12"/>`).join("")}<rect x="72" y="18" width="12" height="12"/></g>
     <circle cx="40" cy="76" r="3.5" fill="#fff"/>
     <path d="M24 70C34 88 60 94 84 88" stroke="#1D7FD0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`,
  ),
  logo(
    "git",
    "Git",
    110,
    110,
    `${die(`<rect x="22" y="22" width="66" height="66" rx="12" transform="rotate(45 55 55)"/>`)}
     <rect x="22" y="22" width="66" height="66" rx="12" transform="rotate(45 55 55)" fill="#F05032"/>
     <g stroke="#fff" stroke-width="5.5" fill="none" stroke-linecap="round"><path d="M47 36V74"/><path d="M47 44L66 60"/></g>
     <g fill="#fff"><circle cx="47" cy="36" r="6.5"/><circle cx="47" cy="74" r="6.5"/><circle cx="67" cy="61" r="6.5"/></g>
     ${sheen(`<rect x="22" y="22" width="66" height="66" rx="12" transform="rotate(45 55 55)"/>`)}`,
  ),
  logo(
    "linux",
    "Linux (Tux)",
    120,
    130,
    `${die(`<path d="M60 12C42 12 36 28 36 44C36 54 26 66 24 82C22 100 38 114 60 114C82 114 98 100 96 82C94 66 84 54 84 44C84 28 78 12 60 12Z"/><ellipse cx="40" cy="114" rx="16" ry="8"/><ellipse cx="80" cy="114" rx="16" ry="8"/>`)}
     <path d="M60 12C42 12 36 28 36 44C36 54 26 66 24 82C22 100 38 114 60 114C82 114 98 100 96 82C94 66 84 54 84 44C84 28 78 12 60 12Z" fill="#1B1B1F" stroke="${O}" stroke-width="3"/>
     <path d="M60 50C46 50 40 64 40 82C40 98 48 106 60 106C72 106 80 98 80 82C80 64 74 50 60 50Z" fill="#F5F2EA"/>
     <g fill="#fff"><ellipse cx="52" cy="34" rx="6" ry="7.5"/><ellipse cx="68" cy="34" rx="6" ry="7.5"/></g>
     <g fill="${O}"><circle cx="53.5" cy="35.5" r="3"/><circle cx="66.5" cy="35.5" r="3"/></g>
     <path d="M50 46C54 40 66 40 70 46C66 52 54 52 50 46Z" fill="#FFB800" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
     <g fill="#FFB800" stroke="${O}" stroke-width="2.5"><ellipse cx="40" cy="113" rx="15" ry="7"/><ellipse cx="80" cy="113" rx="15" ry="7"/></g>
     ${gloss("M44 22q5-6 12-7", 3)}`,
  ),
  logo(
    "vite",
    "Vite",
    120,
    114,
    `${die(`<path d="M10 20L60 104L110 20L60 30Z"/><path d="M70 8L46 54H60L52 92L82 40H66L76 8Z"/>`)}
     <defs>
       <linearGradient id="vt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#41D1FF"/><stop offset="1" stop-color="#BD34FE"/></linearGradient>
       <linearGradient id="vb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFEA83"/><stop offset=".1" stop-color="#FFDD35"/><stop offset="1" stop-color="#FFA800"/></linearGradient>
     </defs>
     <path d="M10 20L60 104L110 20L60 30Z" fill="url(#vt)"/>
     <path d="M70 8L46 54H60L52 92L82 40H66L76 8Z" fill="url(#vb)"/>`,
  ),
  logo(
    "flutter",
    "Flutter",
    100,
    120,
    `${die(`<path d="M58 10L18 50L31 63L84 10Z"/><path d="M84 56H58L36 78L58 100H84L62 78Z"/>`)}
     <path d="M58 10L18 50L31 63L84 10Z" fill="#54C5F8"/>
     <path d="M84 56H58L36 78L47 89Z" fill="#54C5F8"/>
     <path d="M47 89L58 100H84L62 78Z" fill="#01579B"/>
     <path d="M47 89L62 78L58 74Z" fill="#29B6F6"/>`,
  ),
  logo(
    "graphql",
    "GraphQL",
    110,
    120,
    (() => {
      const v = Array.from({ length: 6 }, (_, i) =>
        polar(55, 60, 40, -Math.PI / 2 + (i * Math.PI) / 3)
          .split(" ")
          .map(Number),
      );
      const ring = `M${v.map((p) => p.join(" ")).join("L")}Z`;
      const tri = `M${[v[0], v[2], v[4]].map((p) => p.join(" ")).join("L")}Z`;
      return `${die(`<path d="${ring}" stroke-width="26"/>`)}
        <path d="${ring}" fill="none" stroke="#E10098" stroke-width="4"/>
        <path d="${tri}" fill="none" stroke="#E10098" stroke-width="4" stroke-linejoin="round"/>
        ${v.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" fill="#E10098"/>`).join("")}`;
    })(),
  ),
];
