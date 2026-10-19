/** Physical reference objects for photo-based sticker sizing. Lengths in mm. */

export type ReferenceObject = {
  id: string;
  name: { en: string; th: string };
  /** The length the user marks in the photo. */
  lengthMm: number;
  measure: "width" | "diameter";
  locales: string[];
  source: string;
};

export const REFERENCE_OBJECTS: ReferenceObject[] = [
  {
    id: "id1-card",
    name: { en: "Credit / ID card (long edge)", th: "บัตรเครดิต / บัตรประชาชน (ด้านยาว)" },
    lengthMm: 85.6,
    measure: "width",
    locales: ["th", "en"],
    source: "ISO/IEC 7810 ID-1: 85.60 × 53.98 mm",
  },
  {
    id: "thb-10",
    name: { en: "Thai 10-baht coin", th: "เหรียญ 10 บาท" },
    lengthMm: 26,
    measure: "diameter",
    locales: ["th"],
    source: "Royal Thai Mint via https://en.wikipedia.org/wiki/Ten-baht_coin (26 mm)",
  },
  {
    id: "thb-1",
    name: { en: "Thai 1-baht coin", th: "เหรียญ 1 บาท" },
    lengthMm: 20,
    measure: "diameter",
    locales: ["th"],
    source: "https://en.wikipedia.org/wiki/One-baht_coin (20.00 mm)",
  },
  {
    id: "usd-quarter",
    name: { en: "US quarter", th: "เหรียญควอเตอร์ (สหรัฐฯ)" },
    lengthMm: 24.26,
    measure: "diameter",
    locales: ["en"],
    source: "United States Mint coin specifications (24.26 mm)",
  },
];

export const SIZE_PRESETS_MM = [50, 75, 100] as const;
