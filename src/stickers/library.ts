import { DEMO_ASSETS } from "@/config/demo";
import { BLACK, MONO, O, die, face, gloss, wrap } from "./art";
import { CODE_PACK } from "./code-pack";
import { LANG_LOGOS } from "./lang-logos";
import { PACK_2 } from "./pack-2";
import { SHEET_STICKERS } from "./sheets";

/**
 * Original PeelPlan starter stickers. Authored in-house as plain SVG; no third-party artwork.
 * Each has a white die-cut margin baked in, and a default physical width in mm.
 */

export type StickerCategory = "fun" | "coding" | "character";

export type LibrarySticker = {
  id: string;
  /** Defaults to "fun". "character" entries are demo-only fan art (see config/demo.ts). */
  category?: StickerCategory;
  name: { en: string; th: string };
  widthMm: number;
  viewBox: [number, number];
  /** Inline SVG artwork (in-house stickers). */
  svg?: string;
  /** Static raster URL under /public (stickers cut from supplied sheets). */
  src?: string;
  /** Rights not cleared: only listed when DEMO_ASSETS is on. */
  demo?: boolean;
};

/** Die-cut margin for shapes needing different margin widths (each part: shapes, stroke width), with one shared cut line. */
const dieMix = (parts: [string, number][]) => {
  const layer = (paint: string, extra: number) =>
    `<g fill="#fff" ${paint} stroke-linejoin="round" stroke-linecap="round">${parts.map(([s, w]) => `<g stroke-width="${w + extra}">${s}</g>`).join("")}</g>`;
  return layer(`stroke="#000" stroke-opacity=".13"`, 2) + layer(`stroke="#fff"`, 0);
};

const STAR = "M60.0 17.0L73.5 44.4L103.7 48.8L81.9 70.1L87.0 100.2L60.0 86.0L33.0 100.2L38.1 70.1L16.3 48.8L46.5 44.4Z";
const SEAL =
  "M160.0 85.0L159.2 87.3L157.1 89.5L154.5 91.6L152.2 93.5L151.2 95.5L151.6 97.7L153.1 100.2L155.0 103.0L156.3 105.7L156.3 108.2L154.8 110.1L152.2 111.6L149.0 112.7L146.3 113.9L144.7 115.4L144.4 117.6L145.0 120.5L146.0 123.7L146.4 126.7L145.7 129.1L143.7 130.5L140.7 131.0L137.3 131.1L134.4 131.4L132.4 132.4L131.4 134.4L131.1 137.3L131.0 140.7L130.5 143.7L129.1 145.7L126.7 146.4L123.7 146.0L120.5 145.0L117.6 144.4L115.4 144.7L113.9 146.3L112.7 149.0L111.6 152.2L110.1 154.8L108.2 156.3L105.7 156.3L103.0 155.0L100.2 153.1L97.7 151.6L95.5 151.2L93.5 152.2L91.6 154.5L89.5 157.1L87.3 159.2L85.0 160.0L82.7 159.2L80.5 157.1L78.4 154.5L76.5 152.2L74.5 151.2L72.3 151.6L69.8 153.1L67.0 155.0L64.3 156.3L61.8 156.3L59.9 154.8L58.4 152.2L57.3 149.0L56.1 146.3L54.6 144.7L52.4 144.4L49.5 145.0L46.3 146.0L43.3 146.4L40.9 145.7L39.5 143.7L39.0 140.7L38.9 137.3L38.6 134.4L37.6 132.4L35.6 131.4L32.7 131.1L29.3 131.0L26.3 130.5L24.3 129.1L23.6 126.7L24.0 123.7L25.0 120.5L25.6 117.6L25.3 115.4L23.7 113.9L21.0 112.7L17.8 111.6L15.2 110.1L13.7 108.2L13.7 105.7L15.0 103.0L16.9 100.2L18.4 97.7L18.8 95.5L17.8 93.5L15.5 91.6L12.9 89.5L10.8 87.3L10.0 85.0L10.8 82.7L12.9 80.5L15.5 78.4L17.8 76.5L18.8 74.5L18.4 72.3L16.9 69.8L15.0 67.0L13.7 64.3L13.7 61.8L15.2 59.9L17.8 58.4L21.0 57.3L23.7 56.1L25.3 54.6L25.6 52.4L25.0 49.5L24.0 46.3L23.6 43.3L24.3 40.9L26.3 39.5L29.3 39.0L32.7 38.9L35.6 38.6L37.6 37.6L38.6 35.6L38.9 32.7L39.0 29.3L39.5 26.3L40.9 24.3L43.3 23.6L46.3 24.0L49.5 25.0L52.4 25.6L54.6 25.3L56.1 23.7L57.3 21.0L58.4 17.8L59.9 15.2L61.8 13.7L64.3 13.7L67.0 15.0L69.8 16.9L72.3 18.4L74.5 18.8L76.5 17.8L78.4 15.5L80.5 12.9L82.7 10.8L85.0 10.0L87.3 10.8L89.5 12.9L91.6 15.5L93.5 17.8L95.5 18.8L97.7 18.4L100.2 16.9L103.0 15.0L105.7 13.7L108.2 13.7L110.1 15.2L111.6 17.8L112.7 21.0L113.9 23.7L115.4 25.3L117.6 25.6L120.5 25.0L123.7 24.0L126.7 23.6L129.1 24.3L130.5 26.3L131.0 29.3L131.1 32.7L131.4 35.6L132.4 37.6L134.4 38.6L137.3 38.9L140.7 39.0L143.7 39.5L145.7 40.9L146.4 43.3L146.0 46.3L145.0 49.5L144.4 52.4L144.7 54.6L146.3 56.1L149.0 57.3L152.2 58.4L154.8 59.9L156.3 61.8L156.3 64.3L155.0 67.0L153.1 69.8L151.6 72.3L151.2 74.5L152.2 76.5L154.5 78.4L157.1 80.5L159.2 82.7Z";

export const LIBRARY: LibrarySticker[] = [
  {
    id: "peel-star",
    name: { en: "Peel star", th: "ดาวลอก" },
    widthMm: 55,
    viewBox: [120, 120],
    svg: wrap(
      120,
      120,
      `${die(`<path d="${STAR}"/>`, 25)}
       <defs><clipPath id="peel-star-c"><path d="${STAR}"/></clipPath></defs>
       <path d="${STAR}" fill="${O}" stroke="${O}" stroke-width="13" stroke-linejoin="round"/>
       <path d="${STAR}" fill="#FFCB3D" stroke="#FFCB3D" stroke-width="6" stroke-linejoin="round"/>
       <path d="M60 86L87 100.2L81.9 70.1L103.7 48.8L120 120H40z" fill="#FFB224" clip-path="url(#peel-star-c)"/>
       ${gloss("M36 52q3-4 9-5")}${gloss("M58 26l-4 9", 3.5)}
       ${face(60, 63, 10)}`,
    ),
  },
  {
    id: "mango-sticky",
    name: { en: "Mango sticky rice", th: "ข้าวเหนียวมะม่วง" },
    widthMm: 70,
    viewBox: [160, 110],
    svg: wrap(
      160,
      110,
      `${die(`<ellipse cx="80" cy="74" rx="66" ry="25"/><path d="M30 72C28 50 44 36 62 36C80 36 94 50 92 72Z"/><path d="M84 66C82 46 104 34 128 38C146 41 150 56 140 66C128 74 98 76 84 66Z"/><path d="M30 64C20 52 22 40 34 36C36 48 40 56 30 64Z"/>`)}
       <ellipse cx="80" cy="74" rx="66" ry="25" fill="#EAF4FA" stroke="${O}" stroke-width="3.5"/>
       <ellipse cx="80" cy="72" rx="54" ry="17" fill="#fff" stroke="#CFE3EE" stroke-width="2"/>
       <path d="M30 64C20 52 22 40 34 36C36 48 40 56 30 64Z" fill="#5DBB63" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
       <path d="M30 72C28 50 44 36 62 36C80 36 94 50 92 66C90 70 86 72 80 72Z" fill="#FFFDF6" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <g fill="#EADFC8"><ellipse cx="37" cy="66" rx="2.6" ry="1.4" transform="rotate(-30 37 66)"/><ellipse cx="82" cy="62" rx="2.6" ry="1.4" transform="rotate(25 82 62)"/><ellipse cx="74" cy="44" rx="2.6" ry="1.4" transform="rotate(-15 74 44)"/><ellipse cx="46" cy="46" rx="2.6" ry="1.4" transform="rotate(35 46 46)"/></g>
       ${face(61, 56, 9, 0.9)}
       <path d="M84 66C82 46 104 34 128 38C146 41 150 56 140 66C128 74 98 76 84 66Z" fill="#FFB627" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <g stroke="#E98C17" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M96 66C98 54 106 45 116 41"/><path d="M109 68C111 56 119 47 130 43"/><path d="M123 67C125 58 132 50 141 48"/></g>
       ${gloss("M100 47q10-6 21-6")}`,
    ),
  },
  {
    id: "tiny-planet",
    name: { en: "Tiny planet", th: "ดาวเคราะห์จิ๋ว" },
    widthMm: 60,
    viewBox: [140, 110],
    svg: wrap(
      140,
      110,
      `${die(`<circle cx="70" cy="55" r="31"/><ellipse cx="70" cy="55" rx="56" ry="14" transform="rotate(-14 70 55)"/>`)}
       <g transform="rotate(-14 70 55)" fill="none"><ellipse cx="70" cy="55" rx="56" ry="14" stroke="${O}" stroke-width="11"/><ellipse cx="70" cy="55" rx="56" ry="14" stroke="#FF7A59" stroke-width="5"/></g>
       <circle cx="70" cy="55" r="30" fill="#8B7CF6" stroke="${O}" stroke-width="3.5"/>
       <g fill="#7563EA"><circle cx="56" cy="38" r="5"/><circle cx="86" cy="42" r="3.5"/><circle cx="88" cy="64" r="3"/></g>
       ${gloss("M49 42q5-9 14-11")}
       ${face(70, 47, 9, 0.9)}
       <g transform="rotate(-14 70 55)" fill="none"><path d="M14.55 53.05A56 14 0 1 0 125.45 53.05" stroke="${O}" stroke-width="11"/><path d="M15.23 52.09A56 14 0 1 0 124.77 52.09" stroke="#FF7A59" stroke-width="5"/></g>`,
    ),
  },
  {
    id: "see-actual-size",
    name: { en: "Actual size badge", th: "ป้ายขนาดจริง" },
    widthMm: 75,
    viewBox: [180, 70],
    svg: wrap(
      180,
      70,
      `${die(`<rect x="10" y="10" width="160" height="50" rx="25"/>`)}
       <rect x="10" y="10" width="160" height="50" rx="25" fill="#1B1B1F"/>
       <g stroke="#fff" stroke-opacity=".35" stroke-width="1.5">${Array.from({ length: 21 }, (_, i) => `<path d="M${30 + i * 6} 54v-${i % 5 === 0 ? 6 : 3}"/>`).join("")}</g>
       <text x="90" y="41" text-anchor="middle" font-family="${BLACK}" font-weight="900" font-size="20" letter-spacing="1"><tspan fill="#FF7A59">1:1</tspan><tspan fill="#fff" dx="6">ONLY</tspan></text>`,
    ),
  },
  {
    id: "boba",
    name: { en: "Boba cup", th: "ชานมไข่มุก" },
    widthMm: 45,
    viewBox: [90, 140],
    svg: wrap(
      90,
      140,
      `${die(`<path d="M16 44L74 44L66 126Q65 132 59 132L31 132Q25 132 24 126Z"/><path d="M12 44Q12 26 45 26Q78 26 78 44Z"/><rect x="10" y="40" width="70" height="9" rx="4.5"/><rect x="49" y="10" width="10" height="28" rx="4" transform="rotate(12 54 24)"/>`)}
       <g transform="rotate(12 54 24)"><rect x="49" y="10" width="10" height="28" rx="4" fill="#FF8FB1" stroke="${O}" stroke-width="3"/><path d="M51 17.6l6-2.25M51 25.6l6-2.25" stroke="#fff" stroke-width="2.5"/></g>
       <path d="M16 44L74 44L66 126Q65 132 59 132L31 132Q25 132 24 126Z" fill="#DDB083" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <path d="M17.5 50L72.5 50L71.6 60L18.4 60Z" fill="#F2DCC0"/>
       <path d="M12 44Q12 26 45 26Q78 26 78 44Z" fill="#F4F8FB" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <rect x="10" y="40" width="70" height="9" rx="4.5" fill="#fff" stroke="${O}" stroke-width="3.5"/>
       <g fill="#3B2416"><circle cx="34" cy="120" r="5.5"/><circle cx="46" cy="123" r="5.5"/><circle cx="58" cy="119" r="5.5"/><circle cx="40" cy="110" r="5.5"/><circle cx="53" cy="108" r="5.5"/></g>
       <g fill="#fff" opacity=".7"><circle cx="32.5" cy="118" r="1.5"/><circle cx="44.5" cy="121" r="1.5"/><circle cx="56.5" cy="117" r="1.5"/><circle cx="38.5" cy="108" r="1.5"/><circle cx="51.5" cy="106" r="1.5"/></g>
       ${gloss("M24 62L25.6 80")}${gloss("M24 34q8-4 16-4", 3)}
       ${face(45, 80, 9, 0.95)}`,
    ),
  },
  {
    id: "mushroom",
    name: { en: "Spotty mushroom", th: "เห็ดจุด" },
    widthMm: 48,
    viewBox: [110, 120],
    svg: wrap(
      110,
      120,
      `${die(`<path d="M38 64C36 80 34 92 37 100C41 106 69 106 73 100C76 92 74 80 72 64Z"/><path d="M14 64C14 32 36 16 55 16C74 16 96 32 96 64C96 72 14 72 14 64Z"/>`)}
       <path d="M38 64C36 80 34 92 37 100C41 106 69 106 73 100C76 92 74 80 72 64Z" fill="#FFF1DC" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <path d="M14 64C14 32 36 16 55 16C74 16 96 32 96 64C96 72 14 72 14 64Z" fill="#F0544F" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <path d="M20 62C22 66 88 66 90 62" stroke="#C93A3A" stroke-width="3" fill="none" stroke-linecap="round"/>
       <g fill="#fff"><ellipse cx="38" cy="42" rx="8" ry="6"/><ellipse cx="62" cy="31" rx="6" ry="4.5"/><ellipse cx="78" cy="48" rx="7" ry="5"/><ellipse cx="54" cy="54" rx="4" ry="3.2"/><ellipse cx="25" cy="56" rx="3.5" ry="2.8"/></g>
       ${gloss("M27 38q5-12 17-17")}
       ${face(55, 82, 8, 0.85)}`,
    ),
  },
  {
    id: "elephant",
    name: { en: "Little elephant", th: "ช้างน้อย" },
    widthMm: 62,
    viewBox: [150, 110],
    svg: wrap(
      150,
      110,
      `${dieMix([
         [`<path d="M24 70C22 44 42 30 70 30C92 30 110 40 116 56C120 66 118 76 112 82L112 96Q112 100 108 100L98 100Q94 100 94 96L94 86L62 86L62 96Q62 100 58 100L48 100Q44 100 44 96L44 84C32 82 24 78 24 70Z"/>`, 12],
         [`<path d="M110 62C126 66 134 52 128 40" fill="none"/>`, 26],
         [`<path d="M25 66q-10 2-12 10" fill="none"/>`, 15],
       ])}
       <path d="M25 66q-10 2-12 10" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M110 62C126 66 134 52 128 40" stroke="${O}" stroke-width="14" fill="none" stroke-linecap="round"/>
       <path d="M24 70C22 44 42 30 70 30C92 30 110 40 116 56C120 66 118 76 112 82L112 96Q112 100 108 100L98 100Q94 100 94 96L94 86L62 86L62 96Q62 100 58 100L48 100Q44 100 44 96L44 84C32 82 24 78 24 70Z" fill="#A9B8C9" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <path d="M110 62C126 66 134 52 128 40" stroke="#A9B8C9" stroke-width="7" fill="none" stroke-linecap="round"/>
       <path d="M78 40C64 38 56 50 60 62C64 72 78 72 86 64C90 56 90 44 78 40Z" fill="#C3CFDC" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <ellipse cx="73" cy="55" rx="7" ry="9" fill="#F7B9C8"/>
       <g fill="#fff"><ellipse cx="53" cy="98" rx="4" ry="1.8"/><ellipse cx="103" cy="98" rx="4" ry="1.8"/></g>
       ${gloss("M38 44q12-9 24-10")}
       <ellipse cx="104" cy="66" rx="5" ry="3" fill="#FF8FA3" opacity=".75"/>
       <ellipse cx="100" cy="53" rx="3.6" ry="4.6" fill="${O}"/><circle cx="101.3" cy="51.2" r="1.5" fill="#fff"/>`,
    ),
  },
  {
    id: "lightning",
    name: { en: "Bolt", th: "สายฟ้า" },
    widthMm: 35,
    viewBox: [80, 140],
    svg: wrap(
      80,
      140,
      `${die(`<path d="M48 14L18 78L38 78L31 126L64 60L44 60L60 14Z"/>`, 24)}
       <defs><clipPath id="lightning-c"><path d="M48 14L18 78L38 78L31 126L64 60L44 60L60 14Z"/></clipPath></defs>
       <path d="M48 14L18 78L38 78L31 126L64 60L44 60L60 14Z" fill="${O}" stroke="${O}" stroke-width="12" stroke-linejoin="round"/>
       <path d="M48 14L18 78L38 78L31 126L64 60L44 60L60 14Z" fill="#FFD23F" stroke="#FFD23F" stroke-width="5" stroke-linejoin="round"/>
       <path d="M56 14H80V140H31L64 60H44Z" fill="#FFAE1F" clip-path="url(#lightning-c)"/>
       ${gloss("M45 24L31 56", 3.5)}`,
    ),
  },
  {
    id: "smile-blob",
    name: { en: "Smile blob", th: "ก้อนยิ้ม" },
    widthMm: 50,
    viewBox: [120, 110],
    svg: wrap(
      120,
      110,
      `${die(`<path d="M24 36C34 14 84 12 98 34C112 54 106 84 82 94C60 102 30 98 20 76C12 60 16 48 24 36Z"/><path d="M60 22C52 12 44 13 44 19C50 23 56 23 60 22Z"/><path d="M60 22C66 10 78 10 78 16C72 22 66 24 60 22Z"/>`)}
       <path d="M24 36C34 14 84 12 98 34C112 54 106 84 82 94C60 102 30 98 20 76C12 60 16 48 24 36Z" fill="#7ED6A0" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <path d="M30 84C44 96 74 98 90 86" stroke="#5EBF83" stroke-width="5" fill="none" stroke-linecap="round"/>
       <path d="M60 22C52 12 44 13 44 19C50 23 56 23 60 22Z" fill="#4CAF6A" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
       <path d="M60 22C66 10 78 10 78 16C72 22 66 24 60 22Z" fill="#4CAF6A" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
       ${gloss("M30 44q6-12 18-16")}
       ${face(60, 58, 12, 1.15)}`,
    ),
  },
  {
    id: "wave",
    name: { en: "Wave", th: "คลื่น" },
    widthMm: 65,
    viewBox: [160, 90],
    svg: wrap(
      160,
      90,
      `${die(`<rect x="10" y="10" width="140" height="70" rx="17"/>`)}
       <defs><clipPath id="wave-c"><rect x="10" y="10" width="140" height="70" rx="17"/></clipPath></defs>
       <g clip-path="url(#wave-c)">
         <rect x="10" y="10" width="140" height="70" fill="#D4F0FF"/>
         <circle cx="120" cy="32" r="11" fill="#FFC94A" stroke="${O}" stroke-width="2.5"/>
         <path d="M26 28q4-4 8 0q4-4 8 0M48 20q3-3 6 0q3-3 6 0" stroke="${O}" stroke-width="2" fill="none" stroke-linecap="round"/>
         <path d="M10 70C40 58 70 66 100 58C120 52 136 50 152 46V82H10Z" fill="#8CC4F5" stroke="${O}" stroke-width="2.5"/>
         <path d="M8 66C22 40 48 30 66 38C80 44 82 58 72 62C65 64.5 57 59 61 53C62 51.5 61 50.5 59.5 51C50 54 46 70 60 76C80 84 120 74 152 60V84H8Z" fill="#2F7DE1" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
         <path d="M20 54C32 41 50 35 64 40" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
         <g fill="#fff"><circle cx="70" cy="48" r="2.2"/><circle cx="76" cy="54" r="1.6"/><circle cx="110" cy="66" r="1.8"/></g>
       </g>
       <rect x="10" y="10" width="140" height="70" rx="17" fill="none" stroke="${O}" stroke-width="3"/>`,
    ),
  },
];

/** Original coding-themed stickers (in-house artwork). */
export const CODING: LibrarySticker[] = [
  {
    id: "code-tag",
    category: "coding",
    name: { en: "</> tag", th: "แท็กโค้ด" },
    widthMm: 50,
    viewBox: [130, 100],
    svg: wrap(
      130,
      100,
      `${die(`<rect x="10" y="10" width="110" height="80" rx="18"/>`)}
       <rect x="10" y="10" width="110" height="80" rx="18" fill="#1E1E2E"/>
       <g><circle cx="24" cy="23" r="3.5" fill="#FF5F57"/><circle cx="35" cy="23" r="3.5" fill="#FEBC2E"/><circle cx="46" cy="23" r="3.5" fill="#28C840"/></g>
       <text x="65" y="68" text-anchor="middle" font-family="${MONO}" font-weight="800" font-size="38"><tspan fill="#FF7AB6">&lt;</tspan><tspan fill="#FFD23F">/</tspan><tspan fill="#7AE582">&gt;</tspan></text>`,
    ),
  },
  {
    id: "git-push-force",
    category: "coding",
    name: { en: "git push --force", th: "git push --force" },
    widthMm: 80,
    viewBox: [220, 70],
    svg: wrap(
      220,
      70,
      `${die(`<rect x="10" y="10" width="200" height="50" rx="14"/>`)}
       <rect x="10" y="10" width="200" height="50" rx="14" fill="#F05033"/>
       <g stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"><path d="M30 22v26"/><path d="M30 30c0 7 14 3 14 11"/></g>
       <g fill="#fff"><circle cx="30" cy="22" r="4"/><circle cx="30" cy="48" r="4"/><circle cx="44" cy="43" r="4"/></g>
       <text x="129" y="40.5" text-anchor="middle" font-family="${MONO}" font-weight="800" font-size="14" fill="#fff">git push --force</text>`,
    ),
  },
  {
    id: "works-on-my-machine",
    category: "coding",
    name: { en: "Works on my machine", th: "เครื่องผมรันได้นะ" },
    widthMm: 70,
    viewBox: [170, 170],
    svg: wrap(
      170,
      170,
      `${die(`<path d="${SEAL}"/>`, 15.5)}
       <path d="${SEAL}" fill="#FFD23F" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
       <circle cx="85" cy="85" r="63" fill="none" stroke="${O}" stroke-width="2" stroke-dasharray="4 4"/>
       <defs><path id="t" d="M39 85A46 46 0 0 1 131 85"/><path id="b" d="M31 85A54 54 0 0 0 139 85"/></defs>
       <text font-family="${BLACK}" font-weight="900" font-size="14" letter-spacing="1.5" fill="${O}" text-anchor="middle"><textPath href="#t" startOffset="50%">IT WORKS ON</textPath></text>
       <text font-family="${BLACK}" font-weight="900" font-size="14" letter-spacing="1.5" fill="${O}" text-anchor="middle"><textPath href="#b" startOffset="50%">MY MACHINE</textPath></text>
       <rect x="65" y="68" width="40" height="27" rx="3" fill="#1B1B1F" stroke="${O}" stroke-width="2.5"/>
       <path d="M76 82l6 6 12-12" stroke="#7AE582" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="M57 97h56l-5 7H62z" fill="${O}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: "terminal",
    category: "coding",
    name: { en: "Terminal", th: "เทอร์มินัล" },
    widthMm: 55,
    viewBox: [150, 110],
    svg: wrap(
      150,
      110,
      `${die(`<rect x="10" y="10" width="130" height="90" rx="13"/>`)}
       <rect x="10" y="10" width="130" height="90" rx="13" fill="#0D1117"/>
       <path d="M10 30V23a13 13 0 0 1 13-13h104a13 13 0 0 1 13 13v7z" fill="#21262D"/>
       <circle cx="24" cy="20" r="4" fill="#FF5F57"/><circle cx="36" cy="20" r="4" fill="#FEBC2E"/><circle cx="48" cy="20" r="4" fill="#28C840"/>
       <text x="20" y="50" font-family="${MONO}" font-weight="700" font-size="12"><tspan fill="#7AE582">$</tspan><tspan fill="#E6EDF3" dx="6">npm run dev</tspan></text>
       <text x="20" y="68" font-family="${MONO}" font-weight="600" font-size="11" fill="#8B949E"><tspan fill="#7AE582">✓</tspan> ready in 0.3s</text>
       <text x="20" y="88" font-family="${MONO}" font-weight="700" font-size="12" fill="#7AE582">$</text>
       <rect x="34" y="78" width="8" height="12" rx="1" fill="#7AE582"/>`,
    ),
  },
  {
    id: "bug",
    category: "coding",
    name: { en: "Bug", th: "บั๊ก" },
    widthMm: 45,
    viewBox: [120, 130],
    svg: wrap(
      120,
      130,
      `${dieMix([
         [`<ellipse cx="60" cy="80" rx="32" ry="38"/><ellipse cx="60" cy="40" rx="20" ry="16"/><circle cx="38" cy="14" r="4"/><circle cx="82" cy="14" r="4"/>`, 12],
         [`<path d="M30 64L18 58M28 82L14 84M32 102L20 112M90 64L102 58M92 82L106 84M88 102L100 112" fill="none"/>`, 16],
         [`<path d="M52 28q-6-12-14-14M68 28q6-12 14-14" fill="none"/>`, 15],
       ])}
       <g stroke="${O}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M30 64L18 58M28 82L14 84M32 102L20 112M90 64L102 58M92 82L106 84M88 102L100 112"/></g>
       <g stroke="${O}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M52 28q-6-12-14-14M68 28q6-12 14-14"/></g>
       <g fill="#F2555A" stroke="${O}" stroke-width="2.5"><circle cx="38" cy="14" r="4"/><circle cx="82" cy="14" r="4"/></g>
       <ellipse cx="60" cy="80" rx="32" ry="38" fill="#F2555A" stroke="${O}" stroke-width="3.5"/>
       <path d="M60 46V117" stroke="${O}" stroke-width="3"/>
       <g fill="${O}"><circle cx="45" cy="70" r="6"/><circle cx="76" cy="72" r="6"/><circle cx="47" cy="98" r="5"/><circle cx="73" cy="99" r="5"/></g>
       ${gloss("M38 64q4-10 12-14")}
       <ellipse cx="60" cy="40" rx="20" ry="16" fill="${O}"/>
       <g fill="#fff"><circle cx="52" cy="39" r="5"/><circle cx="68" cy="39" r="5"/></g>
       <g fill="${O}"><circle cx="53" cy="40" r="2.6"/><circle cx="69" cy="40" r="2.6"/></g>
       <path d="M56 47q4 3 8 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "coffee-code",
    category: "coding",
    name: { en: "Coffee → code", th: "กาแฟ → โค้ด" },
    widthMm: 50,
    viewBox: [130, 130],
    svg: wrap(
      130,
      130,
      `${dieMix([
         [`<ellipse cx="57" cy="111" rx="40" ry="7"/><rect x="26" y="40" width="62" height="68" rx="12"/>`, 12],
         [`<path d="M88 54h6c10 0 16 6 16 16s-6 16-16 16h-6Z"/>`, 24],
         [`<path d="M44 30c-6-6 6-10 0-16M58 30c-6-6 6-10 0-16M72 30c-6-6 6-10 0-16" fill="none"/>`, 16],
       ])}
       <ellipse cx="57" cy="111" rx="40" ry="7" fill="#E9E4DE" stroke="${O}" stroke-width="3"/>
       <path d="M88 54h6c10 0 16 6 16 16s-6 16-16 16h-6" fill="none" stroke="${O}" stroke-width="12"/>
       <path d="M88 54h6c10 0 16 6 16 16s-6 16-16 16h-6" fill="none" stroke="#fff" stroke-width="5"/>
       <rect x="26" y="40" width="62" height="68" rx="12" fill="#fff" stroke="${O}" stroke-width="3.5"/>
       <rect x="27.8" y="64" width="58.4" height="22" fill="#FF6B4A"/>
       <text x="57" y="80" text-anchor="middle" font-family="${MONO}" font-weight="800" font-size="15" fill="#fff">&lt;/&gt;</text>
       <ellipse cx="57" cy="43" rx="27" ry="5" fill="#6F4E37" stroke="${O}" stroke-width="2.5"/>
       ${gloss("M34 52v8", 3.5)}
       <path d="M44 30c-6-6 6-10 0-16M58 30c-6-6 6-10 0-16M72 30c-6-6 6-10 0-16" stroke="#B8A99A" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    ),
  },
];

/**
 * DEMO-ONLY fan art of copyrighted characters, drawn in-house as simplified SVG for private mockups.
 * Shown only when DEMO_ASSETS is on. Never ship publicly without a licence from the rights holder.
 */
export const CHARACTERS: LibrarySticker[] = [
  {
    id: "demo-mouse-ears",
    category: "character",
    name: { en: "Mickey (demo)", th: "มิกกี้ (เดโม)" },
    widthMm: 55,
    viewBox: [150, 130],
    svg: wrap(
      150,
      130,
      `<g fill="#fff"><circle cx="34" cy="36" r="32"/><circle cx="116" cy="36" r="32"/><circle cx="75" cy="78" r="50"/></g>
       <g fill="#111"><circle cx="34" cy="36" r="26"/><circle cx="116" cy="36" r="26"/><circle cx="75" cy="78" r="44"/></g>
       <path d="M44 84c0-22 14-34 31-34s31 12 31 34c0 18-14 30-31 30S44 102 44 84z" fill="#F7D2B5"/>
       <path d="M58 60c0-8 6-12 9-12s5 6 5 14M92 60c0-8-6-12-9-12s-5 6-5 14" fill="#F7D2B5"/>
       <g fill="#111"><ellipse cx="66" cy="74" rx="4" ry="9"/><ellipse cx="84" cy="74" rx="4" ry="9"/><ellipse cx="75" cy="90" rx="9" ry="6"/></g>
       <path d="M56 96q19 18 38 0" stroke="#111" stroke-width="4" fill="#B5302A" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "demo-minnie-bow",
    category: "character",
    name: { en: "Minnie bow (demo)", th: "โบว์มินนี่ (เดโม)" },
    widthMm: 50,
    viewBox: [150, 100],
    svg: wrap(
      150,
      100,
      `<path d="M75 50C55 20 18 6 10 26S20 94 75 50c55 44 73 4 65-24S95 20 75 50z" fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"/>
       <path d="M75 50C56 24 22 12 16 28s12 56 59 22c47 34 65 6 59-22S94 24 75 50z" fill="#E63946"/>
       <g fill="#fff"><circle cx="38" cy="36" r="6"/><circle cx="34" cy="62" r="5"/><circle cx="112" cy="36" r="6"/><circle cx="116" cy="62" r="5"/><circle cx="56" cy="50" r="4"/><circle cx="94" cy="50" r="4"/></g>
       <ellipse cx="75" cy="50" rx="13" ry="15" fill="#C1121F"/><circle cx="71" cy="45" r="3" fill="#fff"/>`,
    ),
  },
  {
    id: "demo-blue-robot-cat",
    category: "character",
    name: { en: "Doraemon (demo)", th: "โดราเอมอน (เดโม)" },
    widthMm: 60,
    viewBox: [150, 150],
    svg: wrap(
      150,
      150,
      `<circle cx="75" cy="72" r="70" fill="#fff"/><circle cx="75" cy="70" r="63" fill="#1BA1E2"/>
       <ellipse cx="75" cy="84" rx="50" ry="44" fill="#fff"/>
       <ellipse cx="62" cy="44" rx="13" ry="16" fill="#fff" stroke="#111" stroke-width="2"/><ellipse cx="88" cy="44" rx="13" ry="16" fill="#fff" stroke="#111" stroke-width="2"/>
       <circle cx="66" cy="48" r="4" fill="#111"/><circle cx="84" cy="48" r="4" fill="#111"/>
       <circle cx="75" cy="64" r="8" fill="#E63946" stroke="#111" stroke-width="2"/><circle cx="72" cy="61" r="2.5" fill="#fff"/>
       <path d="M75 72v28" stroke="#111" stroke-width="2"/>
       <path d="M44 92q31 30 62 0" stroke="#111" stroke-width="2.5" fill="#E63946"/>
       <g stroke="#111" stroke-width="2" stroke-linecap="round"><path d="M38 70l24 4M36 80h26M38 90l24-4M112 70l-24 4M114 80H88M112 90l-24-4"/></g>
       <rect x="30" y="122" width="90" height="10" rx="5" fill="#E63946"/><circle cx="75" cy="134" r="9" fill="#FFD23F" stroke="#111" stroke-width="2"/><path d="M68 132h14" stroke="#111" stroke-width="2"/>`,
    ),
  },
  {
    id: "demo-magic-castle",
    category: "character",
    name: { en: "Magic castle (demo)", th: "ปราสาทเวทมนตร์ (เดโม)" },
    widthMm: 65,
    viewBox: [160, 140],
    svg: wrap(
      160,
      140,
      `<rect x="3" y="3" width="154" height="134" rx="30" fill="#fff"/><rect x="10" y="10" width="140" height="120" rx="24" fill="#1D3557"/>
       <g fill="#fff" opacity=".9"><circle cx="30" cy="30" r="1.8"/><circle cx="128" cy="26" r="2"/><circle cx="118" cy="52" r="1.4"/><circle cx="40" cy="58" r="1.4"/></g>
       <g fill="#E0E7FF"><rect x="44" y="70" width="72" height="48"/><rect x="34" y="60" width="16" height="58"/><rect x="110" y="60" width="16" height="58"/><rect x="68" y="44" width="24" height="74"/></g>
       <g fill="#5B8DEF"><path d="M34 60l8-24 8 24z"/><path d="M110 60l8-24 8 24z"/><path d="M68 44l12-30 12 30z"/></g>
       <path d="M72 118v-18a8 8 0 0 1 16 0v18z" fill="#1D3557"/>
       <path d="M18 112c30-30 94-30 124 0" stroke="#FFD23F" stroke-width="3" fill="none" stroke-dasharray="1 7" stroke-linecap="round"/>`,
    ),
  },
];

/** Library as shown to users: characters only in demo mode. */
export const VISIBLE_LIBRARY: LibrarySticker[] = [
  ...LIBRARY,
  ...CODING,
  ...CODE_PACK,
  ...PACK_2,
  ...(DEMO_ASSETS ? [...LANG_LOGOS, ...CHARACTERS, ...SHEET_STICKERS] : []),
];

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Bump when the in-house artwork changes: the SVG route is cached as immutable. */
export const ART_VERSION = 2;

/** Static URL served by app/stickers/[file]/route.ts. */
export const stickerUrl = (id: string) => `/stickers/${id}.svg?v=${ART_VERSION}`;

/** URL for drawing a library sticker (static raster, or the SVG route). */
export const stickerSrc = (def: LibrarySticker) => def.src ?? stickerUrl(def.id);

/** Inline-able image for thumbnails. */
export const stickerThumb = (def: LibrarySticker) => def.src ?? svgDataUrl(def.svg ?? "");

/** Source URL for a visible library sticker by id (empty when it isn't listed, e.g. demo art switched off). */
export const stickerSrcById = (id: string) => {
  const def = VISIBLE_LIBRARY.find((s) => s.id === id);
  return def ? stickerSrc(def) : "";
};
