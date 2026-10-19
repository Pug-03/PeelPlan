import { describe, expect, it } from "vitest";
import type { LayoutItem } from "./layout";
import { layoutWarnings } from "./warnings";

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
