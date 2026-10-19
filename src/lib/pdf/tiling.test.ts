import { describe, expect, it } from "vitest";
import { DEFAULT_TILE_OPTIONS, PAPER, crosshairPoints, planTiles } from "./tiling";

describe("tile planning", () => {
  it("fits a small area on one sheet", () => {
    const p = planTiles(150, 100, PAPER.a4);
    expect(p.tiles).toHaveLength(1);
    expect(p.landscape).toBe(false);
  });

  it("picks the orientation with fewest sheets for a 13-inch lid on A4", () => {
    const p = planTiles(304.1 + 28, 215 + 28, PAPER.a4);
    expect(p.tiles).toHaveLength(2); // portrait 2x1 beats landscape 2x2
  });

  it("tiles a 16-inch lid on Letter with full coverage and overlap", () => {
    const W = 355.7 + 28;
    const H = 248.1 + 28;
    const p = planTiles(W, H, PAPER.letter);
    expect(p.tiles.length).toBeGreaterThan(1);
    const last = p.tiles[p.tiles.length - 1];
    expect(last.xMm + last.widthMm).toBeCloseTo(W, 9);
    expect(last.yMm + last.heightMm).toBeCloseTo(H, 9);
    for (const t of p.tiles) {
      expect(t.widthMm).toBeLessThanOrEqual(p.printableWidthMm + 1e-9);
      expect(t.heightMm).toBeLessThanOrEqual(p.printableHeightMm + 1e-9);
      if (t.col > 0) {
        const left = p.tiles.find((o) => o.row === t.row && o.col === t.col - 1)!;
        expect(left.xMm + left.widthMm - t.xMm).toBeCloseTo(DEFAULT_TILE_OPTIONS.overlapMm, 9);
      }
    }
  });

  it("places crosshairs inside overlap strips", () => {
    const W = 383.7;
    const H = 276.1;
    const p = planTiles(W, H, PAPER.a4);
    const pts = crosshairPoints(p, W, H);
    expect(pts.length).toBeGreaterThan(0);
    for (const pt of pts) {
      const tiles = p.tiles.filter((t) => pt.x >= t.xMm && pt.x <= t.xMm + t.widthMm && pt.y >= t.yMm && pt.y <= t.yMm + t.heightMm);
      expect(tiles.length).toBeGreaterThanOrEqual(2);
    }
  });
});
