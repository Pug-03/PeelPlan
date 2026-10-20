import type { ArtSticker } from "@/components/LidArt";

/**
 * A programmer's lid packed edge to edge: language logos layered under command stickers, the way
 * real dev laptops end up. Laid out for the 14" MacBook Pro lid (312.6 × 221.2 mm); later entries sit on top.
 * The language logos are demo-only, so without demo assets only the in-house code stickers show.
 */
export const PACKED_DEV_LID: ArtSticker[] = [
  // Back layer
  { id: "lang-python", x: 30, y: 30, w: 55, r: -8 },
  { id: "lang-javascript", x: 78, y: 26, w: 48, r: 6 },
  { id: "lang-typescript", x: 124, y: 30, w: 48, r: -4 },
  { id: "lang-rust", x: 174, y: 28, w: 55, r: 10 },
  { id: "lang-go", x: 228, y: 32, w: 58, r: -6 },
  { id: "lang-react", x: 280, y: 30, w: 53, r: 8 },
  { id: "lang-docker", x: 30, y: 84, w: 60, r: 6 },
  { id: "lang-swift", x: 136, y: 80, w: 48, r: 12 },
  { id: "lang-kotlin", x: 184, y: 86, w: 46, r: -8 },
  { id: "lang-node", x: 232, y: 84, w: 53, r: 4 },
  { id: "lang-vue", x: 284, y: 88, w: 48, r: -10 },
  { id: "lang-html", x: 26, y: 140, w: 48, r: -6 },
  { id: "lang-css", x: 70, y: 132, w: 48, r: 8 },
  { id: "lang-git", x: 196, y: 140, w: 48, r: 6 },
  { id: "lang-linux", x: 242, y: 142, w: 55, r: -8 },
  { id: "lang-svelte", x: 288, y: 144, w: 46, r: 10 },
  { id: "lang-java", x: 26, y: 192, w: 50, r: 8 },
  { id: "lang-ruby", x: 70, y: 190, w: 46, r: -6 },
  { id: "lang-cpp", x: 112, y: 192, w: 48, r: 4 },
  { id: "lang-php", x: 206, y: 194, w: 55, r: 6 },
  { id: "lang-ferris", x: 252, y: 192, w: 60, r: -4 },
  { id: "lang-dart", x: 292, y: 194, w: 41, r: 10 },
  // Top layer
  { id: "code-coder", x: 86, y: 84, w: 79, r: -5 },
  { id: "code-term-tests", x: 136, y: 140, w: 84, r: -3 },
  { id: "code-rubber-duck", x: 160, y: 190, w: 50, r: -8 },
  { id: "code-sym-braces", x: 54, y: 56, w: 34, r: -12 },
  { id: "code-key-enter", x: 206, y: 58, w: 34, r: 8 },
  { id: "code-stamp-ship-it", x: 112, y: 112, w: 62, r: -8 },
  { id: "lang-tailwind", x: 170, y: 112, w: 36, r: 12 },
  { id: "code-say-lgtm", x: 268, y: 118, w: 50, r: -6 },
  { id: "lang-graphql", x: 92, y: 164, w: 34, r: 10 },
  { id: "code-err-404", x: 228, y: 170, w: 46, r: 8 },
  { id: "lang-zig", x: 256, y: 60, w: 31, r: -10 },
];
