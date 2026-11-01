/**
 * Laptop lid geometry. All lengths in millimetres.
 *
 * Provenance rules:
 * - `verified: true` fields come from the manufacturer's published tech specs (see `source`).
 * - `verified: false` fields are NOT published by the manufacturer and are working estimates.
 *   They must be replaced with physical measurements (calipers on a real unit) before launch.
 *
 * Lid face vs. footprint: the manufacturer publishes the closed-chassis footprint (width × depth).
 * On these unibody designs the lid covers the full footprint, so lid width = footprint width and
 * lid height = footprint depth. This is an assumption; confirm with a ruler on a real unit.
 */

export type Measured<T> = { value: T; verified: boolean; note?: string };

export type LidColor = { id: string; name: { en: string; th: string }; hex: string };

/** Rough rectangle of a raised camera module, top-left corner measured from the back's top-left. */
export type CameraBump = {
  xMm: Measured<number>;
  yMm: Measured<number>;
  widthMm: Measured<number>;
  heightMm: Measured<number>;
  radiusMm: Measured<number>;
};

export type DeviceKind = "laptop" | "tablet";

export type LaptopModel = {
  id: string;
  /** Laptops show the lid; tablets show the back, held upright (portrait). Defaults to laptop. */
  kind?: DeviceKind;
  brand: string;
  family: string;
  /** Display name; model names are used only for accuracy, never as PeelPlan branding. */
  name: string;
  generation: string;
  lid: {
    widthMm: Measured<number>;
    heightMm: Measured<number>;
    cornerRadiusMm: Measured<number>;
  };
  /** Logo bounding box, centre measured from the lid's top-left with the lid closed and hinge at the bottom. */
  logo: {
    centerXMm: Measured<number>;
    centerYMm: Measured<number>;
    widthMm: Measured<number>;
    heightMm: Measured<number>;
  };
  /** Raised camera module: stickers can't lie flat over it, so it's a hard no-go zone. */
  camera?: CameraBump;
  colors: LidColor[];
  /** How the logo inlay renders: Air = pale mirror, Pro = glossy black (as on apple.com), PROLED Pro = back-lit glow. */
  logoFinish: LogoFinish;
  source: { url: string; retrieved: string; quote: string };
};

export type LogoFinish = "mirror-light" | "gloss-black" | "glow";

const RETRIEVED = "2026-10-19";

const unverified = (value: number, note = "Not published by manufacturer; estimate pending physical measurement."): Measured<number> => ({
  value,
  verified: false,
  note,
});
const official = (value: number): Measured<number> => ({ value, verified: true });

/** Width-to-height ratio of the logo silhouette (leaf included). */
export const LOGO_ASPECT = 0.81; // visible width/height of the silhouette in config/demo.ts

/**
 * Logo is centred on the lid. Height drives the size; width follows the silhouette's aspect.
 * `heightNote` records where the height came from.
 */
const centredLogo = (w: number, h: number, logoH: number, heightNote: string) => ({
  centerXMm: { value: w / 2, verified: false, note: "Assumed horizontally centred." },
  centerYMm: { value: h / 2, verified: false, note: "Assumed vertically centred; measure on a real unit." },
  widthMm: unverified(Math.round(logoH * LOGO_ASPECT * 10) / 10, "Derived from height × silhouette aspect."),
  heightMm: unverified(logoH, heightNote),
});

const GALAXUS_AIR =
  "Third-party measurement: 4.6 cm tall on the 13-inch Air (M2 redesign, carried to M5). https://www.galaxus.nl/en/page/a-hands-on-test-of-the-apple-macbook-air-m2-24279";

const AIR_COLORS: LidColor[] = [
  // Mid-tones sampled from apple.com product renders; the lighting adds the top-to-bottom falloff.
  { id: "sky-blue", name: { en: "Sky Blue", th: "ฟ้าสกาย" }, hex: "#C2CDD7" },
  { id: "silver", name: { en: "Silver", th: "สีเงิน" }, hex: "#CACBCE" },
  { id: "starlight", name: { en: "Starlight", th: "สีสตาร์ไลท์" }, hex: "#D6CCBC" },
  { id: "midnight", name: { en: "Midnight", th: "สีมิดไนท์" }, hex: "#3C424C" },
];

const PRO_COLORS: LidColor[] = [
  { id: "space-black", name: { en: "Space Black", th: "สีดำสเปซแบล็ก" }, hex: "#2B2B2D" },
  { id: "silver", name: { en: "Silver", th: "สีเงิน" }, hex: "#D9DADC" },
];

const NEO_COLORS: LidColor[] = [
  // Estimated from apple.com renders; confirm against a real unit.
  { id: "silver", name: { en: "Silver", th: "สีเงิน" }, hex: "#CACBCE" },
  { id: "blush", name: { en: "Blush", th: "สีบลัช" }, hex: "#E2CDC8" },
  { id: "citrus", name: { en: "Citrus", th: "สีซิตรัส" }, hex: "#DCDAB2" },
  { id: "indigo", name: { en: "Indigo", th: "สีอินดิโก" }, hex: "#3D4560" },
];

export const LAPTOP_MODELS: LaptopModel[] = [
  {
    id: "macbook-neo-13",
    brand: "Apple",
    family: "MacBook Neo",
    name: 'MacBook Neo 13"',
    generation: "A18 Pro",
    lid: { widthMm: official(297.5), heightMm: official(206.4), cornerRadiusMm: unverified(10) },
    logo: centredLogo(297.5, 206.4, 44, "Estimate: no published or third-party measurement found for MacBook Neo. Measure a real unit."),
    colors: NEO_COLORS,
    logoFinish: "mirror-light",
    source: {
      url: "https://www.apple.com/macbook-neo/specs/",
      retrieved: RETRIEVED,
      quote: "Width: 11.71 inches (29.75 cm); Depth: 8.12 inches (20.64 cm)",
    },
  },
  {
    id: "macbook-air-13-m5",
    brand: "Apple",
    family: "MacBook Air",
    name: 'MacBook Air 13"',
    generation: "M5",
    lid: { widthMm: official(304.1), heightMm: official(215.0), cornerRadiusMm: unverified(10) },
    logo: centredLogo(304.1, 215.0, 46, GALAXUS_AIR),
    colors: AIR_COLORS,
    logoFinish: "mirror-light",
    source: {
      url: "https://www.apple.com/macbook-air/specs/",
      retrieved: RETRIEVED,
      quote: "Width: 11.97 inches (30.41 cm); Depth: 8.46 inches (21.5 cm)",
    },
  },
  {
    id: "macbook-air-15-m5",
    brand: "Apple",
    family: "MacBook Air",
    name: 'MacBook Air 15"',
    generation: "M5",
    lid: { widthMm: official(340.4), heightMm: official(237.6), cornerRadiusMm: unverified(11) },
    logo: centredLogo(340.4, 237.6, 46, `Assumed equal to the 13-inch Air; no 15-inch measurement found. ${GALAXUS_AIR}`),
    colors: AIR_COLORS,
    logoFinish: "mirror-light",
    source: {
      url: "https://www.apple.com/macbook-air/specs/",
      retrieved: RETRIEVED,
      quote: "Width: 13.40 inches (34.04 cm); Depth: 9.35 inches (23.76 cm)",
    },
  },
  {
    id: "macbook-pro-14-m5",
    brand: "Apple",
    family: "MacBook Pro",
    name: 'MacBook Pro 14"',
    generation: "M5 / M5 Pro / M5 Max",
    lid: { widthMm: official(312.6), heightMm: official(221.2), cornerRadiusMm: unverified(11) },
    logo: centredLogo(312.6, 221.2, 40, "Estimate: no published or third-party measurement found for the 2021+ 14-inch design. Measure a real unit."),
    colors: PRO_COLORS,
    logoFinish: "gloss-black",
    source: {
      url: "https://www.apple.com/macbook-pro/specs/",
      retrieved: RETRIEVED,
      quote: "Width: 12.31 inches (31.26 cm); Depth: 8.71 inches (22.12 cm)",
    },
  },
  {
    id: "macbook-pro-16-m5",
    brand: "Apple",
    family: "MacBook Pro",
    name: 'MacBook Pro 16"',
    generation: "M5 Pro / M5 Max",
    lid: { widthMm: official(355.7), heightMm: official(248.1), cornerRadiusMm: unverified(12) },
    logo: centredLogo(
      355.7,
      248.1,
      44,
      "Estimate: no measurement found for the 2021+ 16-inch design (a 2019 16-inch was ~35 mm, older design). Measure a real unit.",
    ),
    colors: PRO_COLORS,
    logoFinish: "gloss-black",
    source: {
      url: "https://www.apple.com/macbook-pro/specs/",
      retrieved: RETRIEVED,
      quote: "Width: 14.01 inches (35.57 cm); Depth: 9.77 inches (24.81 cm)",
    },
  },
  // Announced 2026-10-28, on sale 2026-11-06. A thinner, smaller lid than the mini-LED Pro of the same size,
  // so it can't share that model's outline. The lid logo is back-lit again; its size isn't published.
  {
    id: "macbook-pro-14-proled",
    brand: "Apple",
    family: "MacBook Pro",
    name: 'MacBook Pro 14" PROLED XDR',
    generation: "M5 Pro / M5 Max",
    lid: { widthMm: official(310.8), heightMm: official(216.3), cornerRadiusMm: unverified(11) },
    logo: centredLogo(310.8, 216.3, 40, "Estimate: assumed equal to the mini-LED 14-inch; no measurement published yet. Measure a real unit."),
    colors: PRO_COLORS,
    logoFinish: "glow",
    source: {
      url: "https://www.apple.com/macbook-pro/proled-xdr-display/specs/",
      retrieved: "2026-10-31",
      quote: "Width: 12.24 inches (31.08 cm); Depth: 8.52 inches (21.63 cm)",
    },
  },
  {
    id: "macbook-pro-16-proled",
    brand: "Apple",
    family: "MacBook Pro",
    name: 'MacBook Pro 16" PROLED XDR',
    generation: "M5 Pro / M5 Max",
    lid: { widthMm: official(355.5), heightMm: official(244.2), cornerRadiusMm: unverified(12) },
    logo: centredLogo(355.5, 244.2, 44, "Estimate: assumed equal to the mini-LED 16-inch; no measurement published yet. Measure a real unit."),
    colors: PRO_COLORS,
    logoFinish: "glow",
    source: {
      url: "https://www.apple.com/macbook-pro/proled-xdr-display/specs/",
      retrieved: "2026-10-31",
      quote: "Width: 14.0 inches (35.55 cm); Depth: 9.62 inches (24.42 cm)",
    },
  },
];

/* ---------- iPad (preview) ----------
   Back of the tablet held upright, camera at the top left as seen from behind. Width/height come from
   Apple's spec pages; the corner radius, logo size and camera module are estimates until measured. */

const IPAD_PRO_COLORS: LidColor[] = [
  { id: "space-black", name: { en: "Space Black", th: "สีดำสเปซแบล็ก" }, hex: "#2B2B2D" },
  { id: "silver", name: { en: "Silver", th: "สีเงิน" }, hex: "#D9DADC" },
];

const IPAD_AIR_COLORS: LidColor[] = [
  // Estimated from apple.com renders; confirm against a real unit.
  { id: "blue", name: { en: "Blue", th: "สีฟ้า" }, hex: "#B9C7D4" },
  { id: "purple", name: { en: "Purple", th: "สีม่วง" }, hex: "#CEC5D9" },
  { id: "starlight", name: { en: "Starlight", th: "สีสตาร์ไลท์" }, hex: "#E0D8C9" },
  { id: "space-gray", name: { en: "Space Gray", th: "สีเทาสเปซเกรย์" }, hex: "#6B6D72" },
];

const cameraEstimate = (x: number, y: number, w: number, h: number, r: number): CameraBump => ({
  xMm: unverified(x),
  yMm: unverified(y),
  widthMm: unverified(w),
  heightMm: unverified(h),
  radiusMm: unverified(r),
});

/** iPad Pro (M4 and later): one squircle module with the lens, LiDAR and flash. */
const PRO_CAMERA = cameraEstimate(7, 7, 24, 24, 7);
/** iPad Air: a single round lens; the flash beside it sits flush. */
const AIR_CAMERA = cameraEstimate(8, 8, 11, 11, 5.5);

const IPAD_LOGO = "Estimate: iPad logo size not published. Measure a real unit.";

export const TABLET_MODELS: LaptopModel[] = [
  {
    id: "ipad-air-11-m4",
    kind: "tablet",
    brand: "Apple",
    family: "iPad Air",
    name: 'iPad Air 11"',
    generation: "M4",
    lid: { widthMm: official(178.5), heightMm: official(247.6), cornerRadiusMm: unverified(17) },
    logo: centredLogo(178.5, 247.6, 28, IPAD_LOGO),
    camera: AIR_CAMERA,
    colors: IPAD_AIR_COLORS,
    logoFinish: "mirror-light",
    source: { url: "https://www.apple.com/ipad-air/specs/", retrieved: "2026-10-31", quote: "Height: 9.74 inches (247.6 mm); Width: 7.02 inches (178.5 mm)" },
  },
  {
    id: "ipad-air-13-m4",
    kind: "tablet",
    brand: "Apple",
    family: "iPad Air",
    name: 'iPad Air 13"',
    generation: "M4",
    lid: { widthMm: official(214.9), heightMm: official(280.6), cornerRadiusMm: unverified(18) },
    logo: centredLogo(214.9, 280.6, 32, IPAD_LOGO),
    camera: AIR_CAMERA,
    colors: IPAD_AIR_COLORS,
    logoFinish: "mirror-light",
    source: { url: "https://www.apple.com/ipad-air/specs/", retrieved: "2026-10-31", quote: "Height: 11.04 inches (280.6 mm); Width: 8.46 inches (214.9 mm)" },
  },
  {
    id: "ipad-pro-11-m5",
    kind: "tablet",
    brand: "Apple",
    family: "iPad Pro",
    name: 'iPad Pro 11"',
    generation: "M5",
    lid: { widthMm: official(177.5), heightMm: official(249.7), cornerRadiusMm: unverified(17) },
    logo: centredLogo(177.5, 249.7, 28, IPAD_LOGO),
    camera: PRO_CAMERA,
    colors: IPAD_PRO_COLORS,
    logoFinish: "mirror-light",
    source: { url: "https://www.apple.com/ipad-pro/specs/", retrieved: "2026-10-31", quote: "Height: 9.83 inches (249.7 mm); Width: 6.99 inches (177.5 mm)" },
  },
  {
    id: "ipad-pro-13-m5",
    kind: "tablet",
    brand: "Apple",
    family: "iPad Pro",
    name: 'iPad Pro 13"',
    generation: "M5",
    lid: { widthMm: official(215.5), heightMm: official(281.6), cornerRadiusMm: unverified(18) },
    logo: centredLogo(215.5, 281.6, 32, IPAD_LOGO),
    camera: PRO_CAMERA,
    colors: IPAD_PRO_COLORS,
    logoFinish: "mirror-light",
    source: { url: "https://www.apple.com/ipad-pro/specs/", retrieved: "2026-10-31", quote: "Height: 11.09 inches (281.6 mm); Width: 8.48 inches (215.5 mm)" },
  },
];

/**
 * Lenses inside a camera module, centres relative to its top-left (mm): a big squircle gets the
 * wide lens, a LiDAR dot and a flash; a small round module is one lens filling it.
 */
export function cameraLenses(c: { width: number; height: number }): { x: number; y: number; r: number; kind: "lens" | "lidar" | "flash" }[] {
  if (c.width < 15) return [{ x: c.width / 2, y: c.height / 2, r: Math.min(c.width, c.height) * 0.36, kind: "lens" }];
  const u = c.width / 24;
  return [
    { x: 7.5 * u, y: 7.5 * u, r: 4.6 * u, kind: "lens" },
    { x: 16.5 * u, y: 16.5 * u, r: 3 * u, kind: "lidar" },
    { x: 16.5 * u, y: 7 * u, r: 1.6 * u, kind: "flash" },
  ];
}

/** Every model the editor can plan on. The landing page's lineup stays LAPTOP_MODELS. */
export const ALL_MODELS: LaptopModel[] = [...LAPTOP_MODELS, ...TABLET_MODELS];

export const DEFAULT_MODEL_ID = "macbook-air-13-m5";

export function getLaptopModel(id: string): LaptopModel {
  return ALL_MODELS.find((m) => m.id === id) ?? LAPTOP_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
}

/**
 * Whether anything PeelPlan actually draws for this model is an estimate rather than a published
 * spec: the corner radius of the printed lid outline, or the logo box the keep-out area is built
 * from. The width and height are published, so a `true` here never means the lid size is a guess.
 */
export function hasEstimatedGeometry(model: LaptopModel) {
  return !model.lid.cornerRadiusMm.verified || Object.values(model.logo).some((f) => !f.verified) || Object.values(model.camera ?? {}).some((f) => !f.verified);
}

/** Flattened numeric view for rendering. */
export function lidGeometry(model: LaptopModel) {
  return {
    widthMm: model.lid.widthMm.value,
    heightMm: model.lid.heightMm.value,
    cornerRadiusMm: model.lid.cornerRadiusMm.value,
    logo: {
      x: model.logo.centerXMm.value,
      y: model.logo.centerYMm.value,
      width: model.logo.widthMm.value,
      height: model.logo.heightMm.value,
    },
    camera: model.camera
      ? {
          x: model.camera.xMm.value,
          y: model.camera.yMm.value,
          width: model.camera.widthMm.value,
          height: model.camera.heightMm.value,
          radius: model.camera.radiusMm.value,
        }
      : undefined,
  };
}
