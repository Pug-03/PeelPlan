import { describe, expect, it } from "vitest";
import en from "./en.json";
import th from "./th.json";

const keys = (o: object, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe("message catalogs", () => {
  it("th and en have identical keys", () => {
    expect(keys(th).sort()).toEqual(keys(en).sort());
  });
});
