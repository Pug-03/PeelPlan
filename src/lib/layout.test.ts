import { describe, expect, it } from "vitest";
import { csvCell, parseLayout } from "./layout";

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
  it("truncates long labels and fixes unknown finishes", () => {
    const l = parseLayout({ ...good, items: [{ ...good.items[0], label: "x".repeat(500), finish: "chrome" }] })!;
    expect(l.items[0].label).toHaveLength(80);
    expect(l.items[0].finish).toBe("glossy");
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
