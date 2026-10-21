import { describe, expect, it } from "vitest";
import { MAX_SIZE_MM, POSITION_MARGIN_MM, clampItem, csvCell, parseLayout } from "./layout";

const good = {
  version: 1,
  modelId: "macbook-air-13-m5",
  colorId: "silver",
  keepLogoClear: true,
  items: [{ id: "a", assetId: "lib:peel-star", label: "Star", xMm: 10, yMm: 20, widthMm: 55, heightMm: 55, rotationDeg: 15, finish: "matte" }],
};

describe("parseLayout", () => {
  it("accepts and normalises a valid layout", () => {
    const l = parseLayout(good)!;
    expect(l.items[0]).toMatchObject({ finish: "matte", flipX: false, locked: false, borderMm: 0 });
  });
  it.each([
    ["wrong version", { ...good, version: 2 }],
    ["non-string assetId", { ...good, items: [{ ...good.items[0], assetId: 5 }] }],
    ["NaN geometry", { ...good, items: [{ ...good.items[0], xMm: NaN }] }],
    ["absurd size", { ...good, items: [{ ...good.items[0], widthMm: 1e9 }] }],
    ["too many items", { ...good, items: Array(201).fill(good.items[0]) }],
    ["not an object", "hello"],
  ])("rejects %s", (_, bad) => expect(parseLayout(bad)).toBeNull());
  it("renames repeated ids so two stickers are never edited as one", () => {
    const l = parseLayout({ ...good, items: [good.items[0], { ...good.items[0], xMm: 99 }, { ...good.items[0], xMm: 120 }] })!;
    expect(l.items.map((i) => i.id)).toEqual(["a", "a~2", "a~3"]);
    expect(new Set(l.items.map((i) => i.id)).size).toBe(3);
    expect(l.items.every((i) => i.id.length <= 32)).toBe(true);
  });
  it("truncates long labels and fixes unknown finishes", () => {
    const l = parseLayout({ ...good, items: [{ ...good.items[0], label: "x".repeat(500), finish: "chrome" }] })!;
    expect(l.items[0].label).toHaveLength(80);
    expect(l.items[0].finish).toBe("glossy");
  });
});

describe("clampItem", () => {
  const lid = { widthMm: 304.1, heightMm: 215 };
  it("keeps everything parseLayout accepts", () => {
    const wild = { xMm: 5000, yMm: -9000, widthMm: 1e6, heightMm: 0, rotationDeg: -725 };
    const c = clampItem(wild, lid);
    expect(c).toEqual({ xMm: lid.widthMm + POSITION_MARGIN_MM, yMm: -POSITION_MARGIN_MM, widthMm: MAX_SIZE_MM, heightMm: 1, rotationDeg: 355 });
    expect(parseLayout({ ...good, items: [{ ...good.items[0], ...c }] })).not.toBeNull();
  });
  it("leaves a sane item alone", () => {
    const ok = { xMm: 100, yMm: 80, widthMm: 50, heightMm: 40, rotationDeg: 15 };
    expect(clampItem(ok, lid)).toEqual(ok);
  });
  it("replaces NaN geometry instead of storing it", () => {
    expect(clampItem({ xMm: NaN, yMm: 10, widthMm: NaN, heightMm: 20, rotationDeg: NaN }, lid)).toEqual({
      xMm: -POSITION_MARGIN_MM,
      yMm: 10,
      widthMm: 1,
      heightMm: 20,
      rotationDeg: 0,
    });
  });
});

describe("csvCell", () => {
  it("neutralises formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("-2+3")).toBe(`"'-2+3"`);
  });
  it("quotes commas and quotes", () => expect(csvCell('a,"b"')).toBe(`"a,""b"""`));
  it("leaves plain values", () => expect(csvCell(12.5)).toBe("12.5"));
});
