import { describe, expect, it } from "vitest";
import { LAPTOP_MODELS } from "./laptops";

describe("laptop model config", () => {
  it.each(LAPTOP_MODELS.map((m) => [m.id, m] as const))("%s matches its cited source", (_, m) => {
    const cm = [...m.source.quote.matchAll(/\(([\d.]+) cm\)/g)].map((x) => Number(x[1]) * 10);
    expect(cm).toHaveLength(2);
    expect(m.lid.widthMm.value).toBeCloseTo(cm[0], 6);
    expect(m.lid.heightMm.value).toBeCloseTo(cm[1], 6);
    expect(m.lid.widthMm.verified && m.lid.heightMm.verified).toBe(true);
    expect(m.source.url).toMatch(/^https:\/\//);
  });

  it.each(LAPTOP_MODELS.map((m) => [m.id, m] as const))("%s logo sits inside the lid", (_, m) => {
    const { logo, lid } = m;
    expect(logo.centerXMm.value - logo.widthMm.value / 2).toBeGreaterThan(0);
    expect(logo.centerXMm.value + logo.widthMm.value / 2).toBeLessThan(lid.widthMm.value);
    expect(logo.centerYMm.value + logo.heightMm.value / 2).toBeLessThan(lid.heightMm.value);
    expect(m.colors.length).toBeGreaterThan(0);
  });

  it("ids are unique", () => {
    expect(new Set(LAPTOP_MODELS.map((m) => m.id)).size).toBe(LAPTOP_MODELS.length);
  });
});
