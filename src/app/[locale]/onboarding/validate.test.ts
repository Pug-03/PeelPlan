import { describe, expect, it } from "vitest";
import { validateOnboarding } from "./validate";

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const today = new Date(2026, 9, 19);

describe("validateOnboarding", () => {
  it("accepts a complete buyer profile", () => {
    const r = validateOnboarding(form({ displayName: " Mint ", birthDate: "2000-02-29", isShop: "no", terms: "on" }), today);
    expect(r.errors).toEqual({});
    expect(r.data).toMatchObject({ displayName: "Mint", isShop: false, shop: null });
  });

  it("rejects impossible dates, under-age users and missing consent", () => {
    expect(validateOnboarding(form({ displayName: "A", birthDate: "2001-02-29" }), today).errors).toMatchObject({ birthDate: "birthDate", terms: "terms" });
    expect(validateOnboarding(form({ displayName: "A", birthDate: "2015-01-01", terms: "on" }), today).errors).toEqual({ birthDate: "tooYoung" });
  });

  it("applies the shop rules, ignoring unknown product types", () => {
    const r = validateOnboarding(
      form({ displayName: "A", birthDate: "2010-01-01", isShop: "yes", shopName: "S", ownerName: "", productTypes: ["bogus"], terms: "on" }),
      today,
    );
    expect(r.errors).toEqual({ birthDate: "shopTooYoung", shopName: "shopName", ownerName: "ownerName", productTypes: "productTypes" });
  });
});
