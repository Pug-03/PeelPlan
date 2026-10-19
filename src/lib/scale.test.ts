import { describe, expect, it } from "vitest";
import {
  CSS_PX_PER_MM,
  ID1_CARD_MM,
  PT_PER_MM,
  fitPxPerMm,
  formatLength,
  inToMm,
  mmPerImagePx,
  mmToIn,
  mmToPt,
  mmToPx,
  ptToMm,
  pxPerMmFromReference,
  pxToMm,
  sizeFromOneSide,
} from "./scale";

describe("unit constants", () => {
  it("1 inch is 25.4 mm, 72 pt and 96 CSS px", () => {
    expect(inToMm(1)).toBe(25.4);
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(CSS_PX_PER_MM * 25.4).toBeCloseTo(96, 10);
  });

  it("A4 is 595.28 x 841.89 pt", () => {
    expect(mmToPt(210)).toBeCloseTo(595.276, 3);
    expect(mmToPt(297)).toBeCloseTo(841.89, 2);
  });

  it("100 mm is 283.46 pt", () => {
    expect(mmToPt(100)).toBeCloseTo(283.4646, 4);
    expect(PT_PER_MM).toBeCloseTo(2.834645669, 9);
  });
});

describe("round trips stay exact to 1 µm", () => {
  const values = [0.1, 1, 53.98, 85.6, 215, 304.1, 355.7, 1000];
  it.each(values)("mm <-> pt for %s mm", (mm) => {
    expect(Math.abs(ptToMm(mmToPt(mm)) - mm)).toBeLessThan(1e-3);
  });
  it.each(values)("mm <-> px for %s mm at odd densities", (mm) => {
    for (const d of [1.7, 3.7795, 5.02, 9.33]) expect(Math.abs(pxToMm(mmToPx(mm, d), d) - mm)).toBeLessThan(1e-3);
  });
  it.each(values)("mm <-> inch for %s mm", (mm) => {
    expect(inToMm(mmToIn(mm))).toBeCloseTo(mm, 9);
  });
});

describe("calibration", () => {
  it("derives pxPerMm from a matched ID-1 card", () => {
    const d = pxPerMmFromReference(85.6 * 4.2);
    expect(d).toBeCloseTo(4.2, 10);
    expect(mmToPx(ID1_CARD_MM.width, d)).toBeCloseTo(359.52, 6);
  });
  it("rejects non-positive input", () => {
    expect(() => pxPerMmFromReference(0)).toThrow(RangeError);
    expect(() => pxPerMmFromReference(-3)).toThrow(RangeError);
  });
});

describe("fit to viewport", () => {
  it("is limited by the tighter axis", () => {
    expect(fitPxPerMm(300, 200, { width: 600, height: 1000 })).toBe(2);
    expect(fitPxPerMm(300, 200, { width: 6000, height: 400 })).toBe(2);
    expect(fitPxPerMm(300, 200, { width: 640, height: 1000 }, 20)).toBe(2);
  });
});

describe("photo reference sizing", () => {
  it("computes mm per image px from two marked points", () => {
    // Card edge marked across 428 px diagonal-free.
    expect(mmPerImagePx({ x: 10, y: 50 }, { x: 438, y: 50 }, 85.6)).toBeCloseTo(0.2, 10);
    // 3-4-5 triangle: 500 px for a 26 mm coin.
    expect(mmPerImagePx({ x: 0, y: 0 }, { x: 300, y: 400 }, 26)).toBeCloseTo(0.052, 10);
  });
  it("throws when points coincide", () => {
    expect(() => mmPerImagePx({ x: 1, y: 1 }, { x: 1, y: 1 }, 26)).toThrow(RangeError);
  });
});

describe("aspect-locked sizing", () => {
  it("keeps aspect from either side", () => {
    expect(sizeFromOneSide(2, { widthMm: 75 })).toEqual({ widthMm: 75, heightMm: 37.5 });
    expect(sizeFromOneSide(0.5, { heightMm: 100 })).toEqual({ widthMm: 50, heightMm: 100 });
  });
});

describe("formatting", () => {
  it("shows mm, optional inches", () => {
    expect(formatLength(304.1)).toBe("304.1 mm");
    expect(formatLength(25.4, { secondaryInches: true })).toBe("25.4 mm (1.00″)");
  });
});
