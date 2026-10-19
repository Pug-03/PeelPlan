/**
 * Example shops for previewing the marketplace before real sellers exist. Every name, figure and
 * review here is fictional and the pages label them as examples. Replace with database data in Phase 3.
 */
import { EXAMPLE_LAYOUTS } from "@/components/landing/layouts";
import { VISIBLE_LIBRARY } from "@/stickers/library";

export type ShopProduct = { stickerId: string; priceThb: number; finish: "glossy" | "matte" | "clear" | "holo" };
export type ShopReview = { name: string; rating: number; laptop: string; text: { en: string; th: string }; date: string };

export type DemoShop = {
  slug: string;
  name: string;
  initials: string;
  tint: string;
  city: { en: string; th: string };
  joined: string;
  verified: boolean;
  stats: { sold: number; rating: number; reviews: number; followers: number; responseHours: number };
  about: { en: string; th: string };
  productTypes: string[];
  products: ShopProduct[];
  reviews: ShopReview[];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const known = new Set(VISIBLE_LIBRARY.map((s) => s.id));
const FINISHES: ShopProduct["finish"][] = ["glossy", "matte", "clear", "holo"];

const ABOUT: Record<string, { en: string; th: string }> = {
  "mali-paper-club": {
    en: "Hand-cut vinyl stickers from a two-person studio in Nimman. Waterproof, scratch-resistant, made to survive a backpack.",
    th: "สติกเกอร์ไวนิลไดคัทจากสตูดิโอเล็กๆ สองคนแถวนิมมาน กันน้ำ กันรอยขีดข่วน ทนการอยู่ในกระเป๋าเป้",
  },
  "studio-kluay": {
    en: "Stickers for people who write code: languages, inside jokes and terminal art, printed on matte vinyl.",
    th: "สติกเกอร์สำหรับคนเขียนโค้ด ทั้งภาษาโปรแกรม มุกของชาวโปรแกรมเมอร์ และลายเทอร์มินัล พิมพ์บนไวนิลผิวด้าน",
  },
};

const REVIEWS: ShopReview[] = [
  {
    name: "Ploy",
    rating: 5,
    laptop: 'MacBook Air 13"',
    date: "2026-09-28",
    text: { en: "Planned the whole lid here first. Sizes matched the printout exactly.", th: "จัดวางในนี้ก่อนทั้งฝา ขนาดตรงกับที่พิมพ์ออกมาเป๊ะ" },
  },
  {
    name: "Ton",
    rating: 5,
    laptop: 'MacBook Pro 14"',
    date: "2026-09-14",
    text: { en: "Thick vinyl, clean die-cut edges, arrived in two days.", th: "ไวนิลหนา ขอบไดคัทเนียน ได้ของภายในสองวัน" },
  },
  {
    name: "Mint",
    rating: 4,
    laptop: 'MacBook Air 15"',
    date: "2026-08-30",
    text: { en: "Colours are a little brighter than on screen, but I love them.", th: "สีสดกว่าในจอนิดหน่อย แต่ชอบมาก" },
  },
];

/** Deterministic pseudo-random so figures stay stable between renders. */
const seeded = (seed: string) => {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
};

export const DEMO_SHOPS: DemoShop[] = EXAMPLE_LAYOUTS.map((l) => {
  const slug = slugify(l.shop.name);
  const rnd = seeded(slug);
  const ids = [...new Set(l.stickers.map((s) => s.id))].filter((id) => known.has(id));
  // Pad the catalogue with a few related library stickers so the grid feels like a real shop.
  const extra = VISIBLE_LIBRARY.filter((s) => !ids.includes(s.id) && s.id.split("-")[0] === (ids[0] ?? "").split("-")[0]).slice(0, 6);
  const products = [...ids, ...extra.map((s) => s.id)].map((id) => ({
    stickerId: id,
    priceThb: [39, 45, 49, 59, 69, 79][Math.floor(rnd() * 6)],
    finish: FINISHES[Math.floor(rnd() * FINISHES.length)],
  }));
  return {
    slug,
    name: l.shop.name,
    initials: l.shop.initials,
    tint: l.shop.tint,
    city: l.shop.city,
    joined: "2025-08",
    verified: rnd() > 0.3,
    stats: {
      sold: 400 + Math.floor(rnd() * 3200),
      rating: Math.round((4.6 + rnd() * 0.4) * 10) / 10,
      reviews: 40 + Math.floor(rnd() * 400),
      followers: 200 + Math.floor(rnd() * 5000),
      responseHours: 1 + Math.floor(rnd() * 3),
    },
    about: ABOUT[slug] ?? {
      en: "Independent sticker studio. Every design is printed on waterproof vinyl and cut to the exact size listed.",
      th: "สตูดิโอสติกเกอร์อิสระ ทุกลายพิมพ์บนไวนิลกันน้ำ และตัดตามขนาดที่ระบุไว้ทุกชิ้น",
    },
    productTypes: ["die-cut", "vinyl", rnd() > 0.5 ? "holographic" : "clear"],
    products,
    reviews: REVIEWS,
  };
});

export const getDemoShop = (slug: string) => DEMO_SHOPS.find((s) => s.slug === slug);
export const shopSlug = slugify;
