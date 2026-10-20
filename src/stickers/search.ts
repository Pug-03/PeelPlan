import type { LibrarySticker } from "./library";
import { PACK_2_SECTIONS } from "./pack-2";

/**
 * Category chips and search for the sticker library. Pure: groups come from the sticker's pack
 * section, its `category` and a few hand-picked extras; search matches Thai and English names,
 * the id and the alias tags below.
 */

export const STICKER_GROUPS = ["food", "animals", "code", "words", "thai", "nature", "space", "retro", "shapes", "characters"] as const;
export type StickerGroup = (typeof STICKER_GROUPS)[number];
export type GroupFilter = StickerGroup | "all";

/** Chip labels, also searchable ("อาหาร" finds every food sticker). Kept here so tests and search share them. */
export const GROUP_LABELS: Record<StickerGroup, { en: string; th: string }> = {
  food: { en: "Food", th: "อาหาร" },
  animals: { en: "Animals", th: "สัตว์" },
  code: { en: "Code", th: "สายโค้ด" },
  words: { en: "Words", th: "คำพูด" },
  thai: { en: "Thai", th: "ของไทย" },
  nature: { en: "Nature", th: "ธรรมชาติ" },
  space: { en: "Space", th: "อวกาศ" },
  retro: { en: "Retro", th: "ของย้อนยุค" },
  shapes: { en: "Shapes", th: "รูปทรง" },
  characters: { en: "Characters", th: "ตัวละคร" },
};

const SECTION_GROUP: Record<keyof typeof PACK_2_SECTIONS, StickerGroup> = {
  food: "food",
  culture: "thai",
  animals: "animals",
  nature: "nature",
  space: "space",
  retro: "retro",
  words: "words",
  shapes: "shapes",
};

const sectionOf = new Map<string, StickerGroup>(
  Object.entries(PACK_2_SECTIONS).flatMap(([k, list]) => list.map((s) => [s.id, SECTION_GROUP[k as keyof typeof PACK_2_SECTIONS]] as const)),
);

/** Groups on top of the derived one: in-house starters, and stickers that belong to two themes. */
const EXTRA_GROUPS: Record<string, StickerGroup[]> = {
  "peel-star": ["shapes"],
  "mango-sticky": ["food", "thai"],
  "tiny-planet": ["space"],
  "see-actual-size": ["words"],
  boba: ["food"],
  mushroom: ["nature"],
  elephant: ["animals", "thai"],
  lightning: ["shapes", "nature"],
  "smile-blob": ["shapes"],
  wave: ["nature"],
  "works-on-my-machine": ["words"],
  "coffee-code": ["food"],
  // Thai street food and fruit
  ...Object.fromEntries(
    [
      "som-tam",
      "pad-thai",
      "mango",
      "coconut",
      "cha-yen",
      "roti",
      "durian",
      "chili",
      "tom-yum",
      "mangosteen",
      "moo-ping",
      "khanom-krok",
      "iced-coffee-bag",
      "sticky-rice-basket",
    ].map((id) => [`p2-${id}`, ["thai"] as StickerGroup[]]),
  ),
  "p2-elephant-splash": ["animals"],
  "p2-elephant-head": ["animals"],
  "p2-lotus": ["nature"],
  "p2-su-su": ["thai"],
  "p2-mai-pen-rai": ["thai"],
  "p2-555": ["thai"],
  ...Object.fromEntries(["ice-cream", "donut", "pizza", "burger", "sushi", "popsicle", "coffee-mug"].map((id) => [`p2-${id}`, ["food"] as StickerGroup[]])),
};

/** Alias keywords for names that don't say it outright (Thai and English both). */
const TAGS: Record<string, string> = {
  "p2-cat": "cat kitten แมว เหมียว",
  "p2-cat-loaf": "cat kitten แมว เหมียว",
  "cute-09": "cat แมว",
  "demo-blue-robot-cat": "cat แมว robot หุ่นยนต์",
  "p2-pup": "dog puppy หมา สุนัข",
  "p2-bunny": "rabbit",
  "p2-bee": "insect แมลง",
  "p2-snail": "snail",
  "p2-octopus": "squid หมึก",
  "p2-capybara": "คาปิบารา",
  "cute-03": "pig หมู",
  "cute-15": "deer กวาง",
  "doodle-05": "koala animal สัตว์",
  "coffee-code": "coffee",
  "code-brew-coffee": "coffee กาแฟ",
  "code-term-make-coffee": "coffee กาแฟ",
  "p2-iced-coffee-bag": "coffee",
  "p2-coffee-mug": "coffee",
  boba: "bubble tea milk tea drink ชา เครื่องดื่ม",
  "p2-boba-taro": "boba drink เครื่องดื่ม ชา",
  "p2-boba-matcha": "boba green tea drink เครื่องดื่ม",
  "p2-boba-brown-sugar": "bubble tea milk tea drink ชา เครื่องดื่ม ไข่มุก",
  "p2-cha-yen": "tea drink ชานม เครื่องดื่ม",
  "p2-coconut": "drink เครื่องดื่ม",
  "cute-01": "milk drink นม",
  "mango-sticky": "dessert sweet ขนม mango",
  "p2-roti": "dessert sweet ขนม",
  "p2-khanom-krok": "dessert sweet",
  "p2-ice-cream": "dessert sweet ขนม ไอติม",
  "p2-popsicle": "dessert sweet ขนม ice cream ไอศกรีม",
  "p2-donut": "dessert sweet ขนม doughnut",
  "cute-02": "snack ขนม food",
  "cute-13": "cake เค้ก dessert",
  "cute-22": "food อาหาร",
  "cute-25": "donut โดนัท",
  "doodle-02": "food อาหาร อร่อย",
  "p2-pad-thai": "noodle ก๋วยเตี๋ยว เส้น",
  "p2-som-tam": "papaya salad spicy เผ็ด",
  "p2-chili": "spicy เผ็ด",
  "p2-tom-yum": "soup spicy shrimp ซุป เผ็ด",
  "p2-moo-ping": "pork bbq",
  "p2-rice-bowl": "rice",
  "p2-sticky-rice-basket": "rice",
  "p2-dumpling": "dim sum ติ่มซำ",
  "p2-sushi": "japanese ญี่ปุ่น",
  "p2-lotus": "flower ดอกไม้",
  "p2-daisy": "flower ดอกไม้",
  "p2-tulip": "flower ดอกไม้",
  "p2-jasmine-garland": "flower ดอกไม้ มะลิ",
  "p2-cactus": "plant ต้นไม้",
  "p2-monstera": "plant ต้นไม้",
  "p2-seedling": "plant tree ต้นไม้",
  "p2-sun": "weather sunshine แดด อากาศ",
  "p2-rain-cloud": "weather อากาศ",
  "p2-rainbow": "weather",
  "p2-sleepy-moon": "night กลางคืน",
  "p2-twinkle-stars": "star",
  "peel-star": "star",
  "p2-saturn": "planet ดาวเคราะห์",
  "tiny-planet": "saturn ดาวเสาร์",
  "p2-water-gun": "songkran",
  "p2-krathong": "loy krathong ลอยกระทง",
  "p2-sky-lantern": "yi peng ยี่เป็ง loy krathong",
  "p2-temple-roof": "temple",
  "p2-longtail-boat": "boat sea ทะเล",
  "p2-tuk-tuk": "car taxi รถ",
  "p2-cassette": "music เพลง tape",
  "p2-vinyl": "music เพลง",
  "p2-boombox": "music เพลง radio",
  "p2-headphones": "music เพลง",
  "p2-film-camera": "photo ถ่ายรูป",
  "p2-polaroid": "camera photo กล้อง ถ่ายรูป",
  "p2-game-controller": "gamepad joystick เกม",
  "p2-floppy": "save บันทึก computer",
  "p2-laptop": "computer macbook คอมพิวเตอร์",
  "p2-heart": "love รัก",
  "kitty-02": "love heart หัวใจ",
  "doodle-01": "love heart รัก",
  "doodle-04": "love heart รัก",
  "cute-10": "love รัก",
  "p2-555": "haha ขำ ฮา",
  "p2-su-su": "fight สู้",
  "p2-checkmark": "check tick ถูก",
  "p2-sparkle": "shine วิ้ง",
  "p2-smiley": "smile emoji",
  "smile-blob": "smile emoji face",
  "p2-peace-hand": "victory hand มือ",
  "see-actual-size": "1:1 actual size",
  bug: "insect แมลง",
  "lang-javascript": "js",
  "lang-typescript": "ts",
  "lang-python": "py ไพธอน",
  "lang-go": "golang",
  "lang-go-wordmark": "golang",
  "lang-csharp": "c sharp dotnet .net",
  "lang-cpp": "cpp cplusplus",
  "lang-bash": "shell terminal",
  "lang-node": "nodejs javascript",
  "lang-react": "reactjs javascript",
  "lang-nextjs": "nextjs react",
  "lang-docker": "container",
  "lang-linux": "penguin เพนกวิน tux",
  "lang-ferris": "crab ปู",
  "coding-24": "python",
  "coding-16": "python",
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`kitty-${String(i + 1).padStart(2, "0")}`, "hello kitty cat แมว"])),
  ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`mickey-${String(i + 1).padStart(2, "0")}`, "mickey mouse disney หนู"])),
};

/** Every group a sticker appears under (in STICKER_GROUPS order); may be empty only for brand-new ids. */
export function stickerGroups(s: LibrarySticker): StickerGroup[] {
  const set = new Set<StickerGroup>(EXTRA_GROUPS[s.id] ?? []);
  const section = sectionOf.get(s.id);
  if (section) set.add(section);
  if (s.category === "coding") set.add("code");
  // Sheets are demo-only fan art, except the doodle text sheet.
  if (s.category === "character" || s.id.startsWith("demo-")) set.add("characters");
  if (s.id.startsWith("doodle-")) set.add("words");
  return STICKER_GROUPS.filter((g) => set.has(g));
}

/** Lower-case, NFC, no zero-width marks: Thai keyboards and IMEs can emit either. */
export const normalize = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .trim();

export type IndexedSticker = { sticker: LibrarySticker; groups: StickerGroup[]; text: string };

export function buildIndex(list: LibrarySticker[]): IndexedSticker[] {
  return list.map((s) => {
    const groups = stickerGroups(s);
    const text = [
      s.name.en,
      s.name.th,
      s.id.replace(/-/g, " "),
      s.id,
      TAGS[s.id] ?? "",
      ...groups.flatMap((g) => [g, GROUP_LABELS[g].en, GROUP_LABELS[g].th]),
    ].join(" ");
    return { sticker: s, groups, text: normalize(text) };
  });
}

/** Stickers in `group` matching every whitespace-separated word of `query` (substring, so Thai needs no spaces). */
export function searchStickers(index: IndexedSticker[], query: string, group: GroupFilter = "all"): LibrarySticker[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return index.filter((e) => (group === "all" || e.groups.includes(group)) && words.every((w) => e.text.includes(w))).map((e) => e.sticker);
}

/** Groups that have at least one sticker in the index, for showing only useful chips. */
export function groupCounts(index: IndexedSticker[]): Record<StickerGroup, number> {
  const out = Object.fromEntries(STICKER_GROUPS.map((g) => [g, 0])) as Record<StickerGroup, number>;
  for (const e of index) for (const g of e.groups) out[g]++;
  return out;
}
