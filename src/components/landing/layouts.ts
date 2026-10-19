import type { ArtSticker } from "@/components/LidArt";

/**
 * Illustrative layouts for the landing marquee. Shop names are fictional placeholders and are
 * labelled as examples on the page; replace with real shop layouts once the marketplace launches.
 */
export type ExampleLayout = {
  modelId: string;
  color: string;
  shop: { name: string; city: { en: string; th: string }; initials: string; tint: string };
  stickers: ArtSticker[];
};

export const EXAMPLE_LAYOUTS: ExampleLayout[] = [
  {
    modelId: "macbook-air-13-m5",
    color: "#C2CDD7",
    shop: { name: "Mali Paper Club", city: { en: "Chiang Mai", th: "เชียงใหม่" }, initials: "MP", tint: "#FFE3D9" },
    stickers: [
      { id: "mickey-01", x: 60, y: 60, w: 44, r: -8 },
      { id: "coding-03", x: 175, y: 50, w: 62, r: 3 },
      { id: "kitty-03", x: 255, y: 70, w: 44, r: 8 },
      { id: "coding-16", x: 70, y: 165, w: 36, r: -6 },
      { id: "mickey-08", x: 160, y: 165, w: 44, r: 5 },
      { id: "coding-09", x: 250, y: 170, w: 38, r: -10 },
    ],
  },
  {
    modelId: "macbook-pro-14-m5",
    color: "#D9DADC",
    shop: { name: "Studio Kluay", city: { en: "Bangkok", th: "กรุงเทพฯ" }, initials: "SK", tint: "#E3E7FF" },
    stickers: [
      { id: "coding-06", x: 70, y: 60, w: 46, r: -5 },
      { id: "coding-10", x: 160, y: 55, w: 36, r: 6 },
      { id: "coding-14", x: 245, y: 62, w: 40, r: -4 },
      { id: "coding-20", x: 80, y: 165, w: 38, r: 4 },
      { id: "code-coder", x: 175, y: 170, w: 62, r: -4 },
      { id: "coding-07", x: 262, y: 162, w: 32, r: 8 },
    ],
  },
  {
    modelId: "macbook-air-15-m5",
    color: "#C9D6DF",
    shop: { name: "Tiny Tamarind", city: { en: "Khon Kaen", th: "ขอนแก่น" }, initials: "TT", tint: "#DDF5E3" },
    stickers: [
      { id: "kitty-01", x: 65, y: 60, w: 52, r: -6 },
      { id: "kitty-02", x: 170, y: 58, w: 48, r: 5 },
      { id: "kitty-08", x: 280, y: 62, w: 52, r: -4 },
      { id: "kitty-11", x: 80, y: 180, w: 50, r: 6 },
      { id: "kitty-09", x: 185, y: 185, w: 54, r: -3 },
      { id: "kitty-03", x: 285, y: 180, w: 46, r: 8 },
    ],
  },
  {
    modelId: "macbook-pro-16-m5",
    color: "#2B2B2D",
    shop: { name: "Moonlit Mango", city: { en: "Phuket", th: "ภูเก็ต" }, initials: "MM", tint: "#FFF1C9" },
    stickers: [
      { id: "mickey-11", x: 70, y: 60, w: 52, r: -6 },
      { id: "coding-01", x: 180, y: 55, w: 52, r: 4 },
      { id: "mickey-06", x: 290, y: 65, w: 56, r: 6 },
      { id: "coding-08", x: 80, y: 185, w: 46, r: -5 },
      { id: "mickey-13", x: 180, y: 190, w: 40, r: 3 },
      { id: "coding-19", x: 285, y: 185, w: 46, r: -6 },
    ],
  },
  {
    modelId: "macbook-air-13-m5",
    color: "#E3DCCF",
    shop: { name: "Sticky Rice Lab", city: { en: "Bangkok", th: "กรุงเทพฯ" }, initials: "SR", tint: "#FFE0EC" },
    stickers: [
      { id: "kitty-04", x: 65, y: 62, w: 48, r: -6 },
      { id: "mickey-04", x: 160, y: 55, w: 42, r: 5 },
      { id: "coding-04", x: 250, y: 60, w: 40, r: 8 },
      { id: "mickey-16", x: 80, y: 165, w: 46, r: 4 },
      { id: "kitty-10", x: 160, y: 168, w: 44, r: -5 },
      { id: "coding-15", x: 250, y: 165, w: 46, r: -8 },
    ],
  },
];
