import { describe, expect, it } from "vitest";
import type { LayoutItem } from "./layout";
import { layoutWarnings, logoCoverage } from "./warnings";

const it_ = (id: string, xMm: number, yMm: number, o: Partial<LayoutItem> = {}): LayoutItem => ({
  id,
  assetId: "a",
  label: id,
  locked: false,
  finish: "glossy",
  borderMm: 0,
  xMm,
  yMm,
  widthMm: 20,
  heightMm: 20,
  rotationDeg: 0,
  ...o,
});
const lid = { widthMm: 300, heightMm: 200, logo: { x: 150, y: 100, width: 26, height: 30 } };

describe("layoutWarnings", () => {
  it("flags overlapping pairs only", () => {
    const w = layoutWarnings([it_("a", 50, 50), it_("b", 65, 50), it_("c", 200, 50)], lid, false);
    expect([...w.overlapping].sort()).toEqual(["a", "b"]);
  });
  it("counts the die-cut border", () => {
    const w = layoutWarnings([it_("a", 50, 50, { borderMm: 1 }), it_("b", 70.5, 50)], lid, false);
    expect(w.overlapping.size).toBe(2);
  });
  it("flags the logo zone only when asked", () => {
    const items = [it_("a", 150, 100)];
    expect(layoutWarnings(items, lid, true).onLogo.has("a")).toBe(true);
    expect(layoutWarnings(items, lid, false).onLogo.size).toBe(0);
  });
  it("flags stickers within 3 mm of the edge", () => {
    const w = layoutWarnings([it_("a", 12, 50), it_("b", 14, 50)], lid, false);
    expect(w.nearEdge.has("a")).toBe(true);
    expect(w.nearEdge.has("b")).toBe(false);
  });
});

describe("logoCoverage", () => {
  const logo = lid.logo;
  it("is 0 with nothing on the logo", () => {
    expect(logoCoverage([], logo)).toBe(0);
    expect(logoCoverage([it_("a", 30, 30)], logo)).toBe(0);
  });
  it("is 1 when one sticker hides the whole logo", () => {
    expect(logoCoverage([it_("a", 150, 100, { widthMm: 40, heightMm: 40 })], logo)).toBe(1);
  });
  it("is about half when a sticker covers the left half", () => {
    const c = logoCoverage([it_("a", 150 - 20, 100, { widthMm: 40, heightMm: 40 })], logo);
    expect(c).toBeGreaterThan(0.4);
    expect(c).toBeLessThan(0.6);
  });
  it("counts the border and follows rotation", () => {
    // 20 mm wide, 2 mm border: reaches x = 150 - 26 + 12 = 136 without border, 138 with it.
    expect(logoCoverage([it_("a", 126, 100, { borderMm: 2 })], logo)).toBeGreaterThan(logoCoverage([it_("a", 126, 100)], logo));
    // A thin strip near the logo's right edge only clips that edge upright, but turned 90° it crosses the middle.
    const upright = logoCoverage([it_("a", 160, 100, { widthMm: 6, heightMm: 60 })], logo);
    const turned = logoCoverage([it_("a", 160, 100, { widthMm: 6, heightMm: 60, rotationDeg: 90 })], logo);
    expect(upright).toBeGreaterThan(0);
    expect(turned).toBeGreaterThan(upright);
  });
});
