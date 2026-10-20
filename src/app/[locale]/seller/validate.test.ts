import { describe, expect, it } from "vitest";
import { LINK_KINDS } from "@/features/market/types";
import { normalizeLink, parseMm, validateProduct, validateSettings, type SettingsDraft } from "./validate";

describe("parseMm", () => {
  it("accepts 5–400 mm with one decimal", () => {
    expect(parseMm("5")).toBe(5);
    expect(parseMm("62,5")).toBe(62.5);
    expect(parseMm("400")).toBe(400);
    expect(parseMm("4.9")).toBeNull();
    expect(parseMm("12.25")).toBeNull();
    expect(parseMm("401")).toBeNull();
    expect(parseMm("")).toBeNull();
  });
});

describe("validateProduct", () => {
  const base = { name: "Star", image: "data:x", widthMm: "50", heightMm: "48.5", priceThb: "35", stock: "", madeToOrder: true, finish: "matte" as const, active: true };
  it("builds a product, made to order = null stock", () => {
    const r = validateProduct(base);
    expect(r.errors).toEqual({});
    expect(r.data).toMatchObject({ widthMm: 50, heightMm: 48.5, priceThb: 35, stock: null });
  });
  it("requires size, price and stock", () => {
    const r = validateProduct({ ...base, image: "", widthMm: "2", priceThb: "0", madeToOrder: false, stock: "-1" });
    expect(Object.keys(r.errors).sort()).toEqual(["image", "priceThb", "stock", "widthMm"]);
  });
});

describe("links and settings", () => {
  it("only keeps https links, adding the scheme when missing", () => {
    expect(normalizeLink("line.me/ti/p/@peel")).toBe("https://line.me/ti/p/@peel");
    expect(normalizeLink("http://shopee.co.th/x")).toBeNull();
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
  });
  const draft: SettingsDraft = {
    name: "Peel Co",
    about: "",
    city: "",
    tint: "#E8F7B0",
    shippingThb: "40",
    freeShippingFromThb: "",
    productTypes: ["die-cut"],
    promptpayId: "",
    promptpayName: "",
    links: Object.fromEntries(LINK_KINDS.map((k) => [k, ""])) as SettingsDraft["links"],
  };
  it("validates PromptPay as a pair", () => {
    expect(validateSettings({ ...draft, promptpayId: "081-234-5678" }).errors).toEqual({ promptpayName: "promptpayName" });
    expect(validateSettings({ ...draft, promptpayId: "081-234-5678", promptpayName: "Peel Co" }).patch?.promptpay).toEqual({ id: "0812345678", name: "Peel Co" });
    expect(validateSettings({ ...draft, promptpayId: "123", promptpayName: "Peel Co" }).errors).toEqual({ promptpayId: "promptpayId" });
  });
});
