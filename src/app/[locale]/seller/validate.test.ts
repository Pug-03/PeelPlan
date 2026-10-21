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
  const base = {
    name: "Star",
    image: "data:x",
    widthMm: "50",
    heightMm: "48.5",
    priceThb: "35",
    stock: "",
    madeToOrder: true,
    finish: "matte" as const,
    active: true,
  };
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
  it("keeps each link on its own platform, like the database", () => {
    expect(normalizeLink("https://www.tiktok.com/@peel", "tiktok")).toBe("https://www.tiktok.com/@peel");
    expect(normalizeLink("shopee.co.th/peel", "shopee")).toBe("https://shopee.co.th/peel");
    expect(normalizeLink("https://lin.ee/abc", "line")).toBe("https://lin.ee/abc");
    expect(normalizeLink("https://shopee.co.th/peel", "lazada")).toBeNull();
    expect(normalizeLink("https://shopee.co.th@evil.example/x", "shopee")).toBeNull();
    expect(normalizeLink("https://shopee.co.th:8443/x", "shopee")).toBeNull();
    expect(normalizeLink("https://notshopee.co.th/x", "shopee")).toBeNull();
    expect(normalizeLink("https://shopee.co.th.evil.example/x", "shopee")).toBeNull();
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
  it("names the platform when a link points elsewhere", () => {
    const links = { ...draft.links, facebook: "https://instagram.com/peel", tiktok: "not a link" };
    expect(validateSettings({ ...draft, links }).errors).toEqual({ link_facebook: "linkHost.facebook", link_tiktok: "link" });
  });
  it("validates PromptPay as a pair", () => {
    expect(validateSettings({ ...draft, promptpayId: "081-234-5678" }).errors).toEqual({ promptpayName: "promptpayName" });
    expect(validateSettings({ ...draft, promptpayId: "081-234-5678", promptpayName: "Peel Co" }).patch?.promptpay).toEqual({
      id: "0812345678",
      name: "Peel Co",
    });
    expect(validateSettings({ ...draft, promptpayId: "123", promptpayName: "Peel Co" }).errors).toEqual({ promptpayId: "promptpayId" });
  });
});
