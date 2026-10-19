import { describe, expect, it } from "vitest";
import { computeSnap } from "./snap";

const lid = { widthMm: 300, heightMm: 200 };

describe("computeSnap", () => {
  it("snaps to lid centre", () => {
    const r = computeSnap({ minX: 128, minY: 20, maxX: 168, maxY: 60 }, [], lid, 3);
    expect(r.dx).toBeCloseTo(2, 9); // centre 148 -> 150
    expect(r.guides.some((g) => g.kind === "line" && g.axis === "x" && g.at === 150)).toBe(true);
  });

  it("snaps to the safe margin", () => {
    const r = computeSnap({ minX: 6.5, minY: 80, maxX: 46.5, maxY: 120 }, [], lid, 3, 5);
    expect(r.dx).toBeCloseTo(-1.5, 9);
  });

  it("aligns to another sticker's top edge", () => {
    const r = computeSnap({ minX: 200, minY: 41, maxX: 240, maxY: 81 }, [{ minX: 20, minY: 40, maxX: 60, maxY: 70 }], lid, 2);
    expect(r.dy).toBeCloseTo(-1, 9);
  });

  it("continues equal spacing", () => {
    const others = [
      { minX: 10, minY: 50, maxX: 40, maxY: 80 },
      { minX: 60, minY: 50, maxX: 90, maxY: 80 },
    ];
    // Gap is 20, so the next sticker should start at 110.
    const r = computeSnap({ minX: 111.2, minY: 50, maxX: 141.2, maxY: 80 }, others, lid, 2);
    expect(r.dx).toBeCloseTo(-1.2, 9);
    expect(r.guides.some((g) => g.kind === "gap" && g.gapMm === 20)).toBe(true);
  });

  it("does nothing beyond the threshold", () => {
    const r = computeSnap({ minX: 100, minY: 100, maxX: 120, maxY: 113 }, [], lid, 1);
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});
