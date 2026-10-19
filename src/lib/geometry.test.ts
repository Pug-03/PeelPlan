import { describe, expect, it } from "vitest";
import { apply, boundingBox, compose, corners, rectsOverlap, rotateDeg, scale, translate } from "./geometry";

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe("matrices", () => {
  it("applies right-most first", () => {
    const m = compose(translate(10, 0), scale(2));
    close(apply(m, { x: 1, y: 1 }), { x: 12, y: 2 });
  });
  it("rotates clockwise in y-down space", () => {
    close(apply(rotateDeg(90), { x: 1, y: 0 }), { x: 0, y: 1 });
  });
});

describe("placement corners", () => {
  it("unrotated sticker spans its mm size", () => {
    const bb = boundingBox(corners({ xMm: 50, yMm: 40, widthMm: 30, heightMm: 20, rotationDeg: 0 }));
    expect(bb).toMatchObject({ minX: 35, minY: 30, maxX: 65, maxY: 50 });
  });
  it("90° swaps extents", () => {
    const bb = boundingBox(corners({ xMm: 0, yMm: 0, widthMm: 30, heightMm: 20, rotationDeg: 90 }));
    expect(bb.width).toBeCloseTo(20, 9);
    expect(bb.height).toBeCloseTo(30, 9);
  });
  it("flip keeps the footprint", () => {
    const a = boundingBox(corners({ xMm: 5, yMm: 5, widthMm: 10, heightMm: 4, rotationDeg: 30 }));
    const b = boundingBox(corners({ xMm: 5, yMm: 5, widthMm: 10, heightMm: 4, rotationDeg: 30, flipX: true }));
    expect(a.width).toBeCloseTo(b.width, 9);
  });
});

describe("overlap", () => {
  const base = { widthMm: 10, heightMm: 10, rotationDeg: 0 };
  it("detects overlap and ignores touching", () => {
    expect(rectsOverlap({ ...base, xMm: 0, yMm: 0 }, { ...base, xMm: 9, yMm: 0 })).toBe(true);
    expect(rectsOverlap({ ...base, xMm: 0, yMm: 0 }, { ...base, xMm: 10, yMm: 0 })).toBe(false);
  });
  it("handles rotation (45° diamond reaches further)", () => {
    expect(rectsOverlap({ ...base, xMm: 0, yMm: 0, rotationDeg: 45 }, { ...base, xMm: 11.5, yMm: 0 })).toBe(true);
    expect(rectsOverlap({ ...base, xMm: 0, yMm: 0, rotationDeg: 45 }, { ...base, xMm: 12.2, yMm: 0 })).toBe(false);
  });
});
