import { PRODUCT_TYPES } from "@/config/onboarding";
import { normalizePromptPayId } from "@/features/market/promptpay";
import type { NewProduct, ShopPatch } from "@/features/market/store";
import { LINK_KINDS, type Finish, type LinkKind } from "@/features/market/types";

/** Error codes map to `seller.errors.<code>` messages. */
export type Errors<K extends string> = Partial<Record<K, string>>;

/** Physical size in mm: 5–400, at most one decimal. Physical size is what PeelPlan plans with. */
export function parseMm(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d)?$/.test(s)) return null;
  const n = Number(s);
  return n >= 5 && n <= 400 ? n : null;
}

const int = (raw: string, min: number, max: number) => {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

export type ProductDraft = {
  name: string;
  image: string;
  stickerId?: string;
  widthMm: string;
  heightMm: string;
  priceThb: string;
  stock: string;
  madeToOrder: boolean;
  finish: Finish;
  active: boolean;
};

export type ProductField = "name" | "image" | "widthMm" | "heightMm" | "priceThb" | "stock";

export function validateProduct(d: ProductDraft): { errors: Errors<ProductField>; data: NewProduct | null } {
  const errors: Errors<ProductField> = {};
  const name = d.name.trim();
  if (name.length < 1 || name.length > 80) errors.name = "productName";
  if (!d.image) errors.image = "image";
  const widthMm = parseMm(d.widthMm);
  const heightMm = parseMm(d.heightMm);
  if (widthMm === null) errors.widthMm = "mm";
  if (heightMm === null) errors.heightMm = "mm";
  const priceThb = int(d.priceThb, 1, 100000);
  if (priceThb === null) errors.priceThb = "price";
  const stock = d.madeToOrder ? null : int(d.stock, 0, 100000);
  if (!d.madeToOrder && stock === null) errors.stock = "stock";
  if (Object.keys(errors).length) return { errors, data: null };
  return {
    errors,
    data: {
      name,
      image: d.image,
      ...(d.stickerId ? { stickerId: d.stickerId } : {}),
      widthMm: widthMm!,
      heightMm: heightMm!,
      priceThb: priceThb!,
      stock,
      finish: d.finish,
      active: d.active,
    },
  };
}

/**
 * Each link must stay on its own platform (same rule as the database, 0004 `shop_links_hosts_valid`):
 * the platform's domain or a subdomain, then '/', '?', '#' or the end. That rejects userinfo tricks
 * (`https://shopee.co.th@evil.example`) and ports. LINE also has its short-link host lin.ee.
 */
const LINK_HOSTS: Record<LinkKind, RegExp> = {
  tiktok: /^https:\/\/([a-z0-9-]+\.)*tiktok\.com([/?#]|$)/i,
  shopee: /^https:\/\/([a-z0-9-]+\.)*shopee\.co\.th([/?#]|$)/i,
  lazada: /^https:\/\/([a-z0-9-]+\.)*lazada\.co\.th([/?#]|$)/i,
  instagram: /^https:\/\/([a-z0-9-]+\.)*instagram\.com([/?#]|$)/i,
  facebook: /^https:\/\/([a-z0-9-]+\.)*facebook\.com([/?#]|$)/i,
  line: /^https:\/\/(([a-z0-9-]+\.)*line\.me|lin\.ee)([/?#]|$)/i,
};

/**
 * https URL, or null. A missing scheme gets https:// (people paste "line.me/ti/p/…" or "shopee.co.th/…").
 * With `kind`, the URL must also be on that platform (see LINK_HOSTS).
 */
export function normalizeLink(raw: string, kind?: LinkKind): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
    const out = u.toString();
    return kind && !LINK_HOSTS[kind].test(out) ? null : out;
  } catch {
    return null;
  }
}

export type SettingsDraft = {
  name: string;
  about: string;
  city: string;
  tint: string;
  logo?: string;
  cover?: string;
  shippingThb: string;
  freeShippingFromThb: string;
  productTypes: string[];
  promptpayId: string;
  promptpayName: string;
  links: Record<LinkKind, string>;
};

export type SettingsField =
  "name" | "about" | "city" | "shippingThb" | "freeShippingFromThb" | "productTypes" | "promptpayId" | "promptpayName" | `link_${LinkKind}`;

export function validateSettings(d: SettingsDraft): { errors: Errors<SettingsField>; patch: (ShopPatch & { name: string }) | null } {
  const errors: Errors<SettingsField> = {};
  const name = d.name.trim();
  if (name.length < 2 || name.length > 80) errors.name = "shopName";
  const about = d.about.trim();
  if (about.length > 1000) errors.about = "about";
  const city = d.city.trim();
  if (city.length > 80) errors.city = "city";
  const shippingThb = int(d.shippingThb, 0, 1000);
  if (shippingThb === null) errors.shippingThb = "shipping";
  let freeShippingFromThb: number | undefined;
  if (d.freeShippingFromThb.trim()) {
    const n = int(d.freeShippingFromThb, 1, 100000);
    if (n === null) errors.freeShippingFromThb = "freeShipping";
    else freeShippingFromThb = n;
  }
  const productTypes = d.productTypes.filter((t) => (PRODUCT_TYPES as readonly string[]).includes(t));
  if (!productTypes.length) errors.productTypes = "productTypes";

  // PromptPay is optional until the seller wants to take orders, but both parts go together.
  let promptpay: ShopPatch["promptpay"];
  const ppRaw = d.promptpayId.trim();
  const ppName = d.promptpayName.trim();
  if (ppRaw || ppName) {
    const id = normalizePromptPayId(ppRaw);
    if (!id) errors.promptpayId = "promptpayId";
    if (ppName.length < 2 || ppName.length > 120) errors.promptpayName = "promptpayName";
    if (id && !errors.promptpayName) promptpay = { id, name: ppName };
  }

  const links: ShopPatch["links"] = {};
  for (const k of LINK_KINDS) {
    if (!d.links[k].trim()) continue;
    const url = normalizeLink(d.links[k], k);
    // A valid https link on the wrong site gets the platform-specific message.
    if (!url) errors[`link_${k}`] = normalizeLink(d.links[k]) ? `linkHost.${k}` : "link";
    else links[k] = url;
  }

  if (Object.keys(errors).length) return { errors, patch: null };
  return {
    errors,
    patch: {
      name,
      about,
      city,
      tint: d.tint,
      logo: d.logo,
      cover: d.cover,
      shippingThb: shippingThb!,
      freeShippingFromThb,
      productTypes,
      promptpay,
      links,
    },
  };
}
