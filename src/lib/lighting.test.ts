import { describe, expect, it } from "vitest";
import { lidLighting, luminance, shade } from "./lighting";

describe("shade", () => {
  it("mixes towards white and black", () => {
    expect(shade("#808080", 1)).toBe("#ffffff");
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#000000", 0.5)).toBe("#808080");
  });
});

describe("lidLighting", () => {
  const size = { widthMm: 300, heightMm: 200 };
  it("lights the side nearest the light", () => {
    const { base } = lidLighting("#D9DADC", size, { u: 0, v: 0 });
    expect(luminance(base.stops[0][1])).toBeGreaterThan(luminance(base.stops[2][1]));
    expect(base.start.x).toBeLessThan(base.end.x);
    expect(base.start.y).toBeLessThan(base.end.y);
  });
  it("puts the hotspot at the light", () => {
    expect(lidLighting("#2E3640", size, { u: 0.5, v: 0.25 }).specular.center).toEqual({ x: 150, y: 50 });
  });
  it("treats midnight as dark and silver as light", () => {
    expect(lidLighting("#2E3640", size).dark).toBe(true);
    expect(lidLighting("#D9DADC", size).dark).toBe(false);
  });
  it("survives a light exactly at the centre", () => {
    const { base } = lidLighting("#D9DADC", size, { u: 0.5, v: 0.5 });
    expect(Number.isFinite(base.end.y)).toBe(true);
  });
});
