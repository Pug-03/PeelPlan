import { describe, expect, it } from "vitest";
import { rectsOverlap } from "./geometry";
import type { LayoutItem } from "./layout";
import { findFreeSpot } from "./placement";

const lid = { widthMm: 300, heightMm: 200, logo: { x: 150, y: 100, width: 26, height: 30 } };

describe("findFreeSpot", () => {
  it("never overlaps existing stickers while room remains", () => {
    const items: LayoutItem[] = [];
    for (let i = 0; i < 12; i++) {
      const size = { widthMm: 50, heightMm: 40 };
      const p = findFreeSpot(size, items, lid, true);
      const it: LayoutItem = { id: String(i), assetId: "a", label: "", locked: false, finish: "glossy", borderMm: 0, rotationDeg: 0, ...size, ...p };
      expect(items.some((o) => rectsOverlap(o, it))).toBe(false);
      expect(rectsOverlap(it, { xMm: 150, yMm: 100, widthMm: 26, heightMm: 30, rotationDeg: 0 })).toBe(false);
      items.push(it);
    }
  });

  it("still respects rotated stickers, which skip the box-only fast path", () => {
    const items: LayoutItem[] = [];
    for (let i = 0; i < 10; i++) {
      const size = { widthMm: 50, heightMm: 40 };
      const p = findFreeSpot(size, items, lid, true);
      const it: LayoutItem = { id: String(i), assetId: "a", label: "", locked: false, finish: "glossy", borderMm: 0, rotationDeg: 23, ...size, ...p };
      expect(items.some((o) => rectsOverlap(o, it))).toBe(false);
      items.push(it);
    }
  });

  it("never falls back onto the logo when the lid is full", () => {
    const full: LayoutItem = {
      id: "big",
      assetId: "a",
      label: "",
      locked: false,
      finish: "glossy",
      borderMm: 0,
      rotationDeg: 0,
      xMm: 150,
      yMm: 100,
      widthMm: 298,
      heightMm: 198,
    };
    const p = findFreeSpot({ widthMm: 20, heightMm: 20 }, [full], lid, true);
    expect(rectsOverlap({ ...p, widthMm: 20, heightMm: 20, rotationDeg: 0 }, { xMm: 150, yMm: 100, widthMm: 34, heightMm: 38, rotationDeg: 0 })).toBe(false);
  });
});
