"use client";

/**
 * Marketplace data access. One interface, two backends:
 * - Test mode (no Supabase keys): everything lives in this browser's localStorage, so the whole
 *   buy → pay → ship → chat loop can be tried on one device. The example shops are read-only and
 *   answer chats with a canned reply; they never show a payable QR.
 * - Supabase: see ./supabaseStore.ts (same interface, backed by migration 0002).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { DEMO_SHOPS } from "@/config/demoShops";
import { AUTH_ENABLED } from "@/lib/supabase/config";
import { VISIBLE_LIBRARY, stickerThumb } from "@/stickers/library";
import type { Address, Message, Order, OrderStatus, Product, Shop, Thread } from "./types";

export type NewProduct = Omit<Product, "id" | "shopId" | "createdAt">;
export type ShopPatch = Partial<Omit<Shop, "id" | "ownerId" | "status" | "createdAt" | "example">>;

export interface MarketStore {
  listShops(): Promise<Shop[]>;
  getShop(slug: string): Promise<Shop | null>;
  getShopById(id: string): Promise<Shop | null>;
  myShop(userId: string): Promise<Shop | null>;
  /** Create (first call) or update the signed-in seller's shop. */
  saveMyShop(userId: string, patch: ShopPatch & { name: string }): Promise<Shop>;
  listProducts(shopId: string, opts?: { includeInactive?: boolean }): Promise<Product[]>;
  getProducts(ids: string[]): Promise<Product[]>;
  saveProduct(shopId: string, product: NewProduct, id?: string): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  placeOrder(input: { buyerId: string; shopId: string; lines: { productId: string; qty: number }[]; address: Address; note: string }): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  buyerOrders(buyerId: string): Promise<Order[]>;
  shopOrders(shopId: string): Promise<Order[]>;
  submitSlip(orderId: string, slip: string): Promise<Order>;
  setOrderStatus(orderId: string, status: OrderStatus, extra?: { tracking?: Order["tracking"]; cancelReason?: string }): Promise<Order>;

  openThread(shopId: string, buyerId: string, buyerName: string): Promise<Thread>;
  getThread(id: string): Promise<Thread | null>;
  buyerThreads(buyerId: string): Promise<Thread[]>;
  shopThreads(shopId: string): Promise<Thread[]>;
  messages(threadId: string): Promise<Message[]>;
  send(threadId: string, from: "buyer" | "shop", body: { text?: string; image?: string; orderId?: string }): Promise<Message>;
  markRead(threadId: string, side: "buyer" | "shop"): Promise<void>;

  /** Test mode only: let the tester approve their own pending shop. */
  approveForTesting?(shopId: string): Promise<void>;
  /** Fires after any change, so views can reload. */
  subscribe(cb: () => void): () => void;
}

/* ---------- helpers shared by both backends ---------- */

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "shop";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const orderCode = () => `PP-${Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("")}`;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();

export function shippingFor(shop: Pick<Shop, "shippingThb" | "freeShippingFromThb">, subtotal: number) {
  return shop.freeShippingFromThb && subtotal >= shop.freeShippingFromThb ? 0 : shop.shippingThb;
}

/** Which status changes each side may make. Enforced again in the database. */
export const NEXT_STATUS: Record<OrderStatus, { shop: OrderStatus[]; buyer: OrderStatus[] }> = {
  awaiting_payment: { shop: ["cancelled"], buyer: ["cancelled"] },
  slip_submitted: { shop: ["paid", "awaiting_payment"], buyer: [] },
  paid: { shop: ["shipped", "cancelled"], buyer: [] },
  shipped: { shop: [], buyer: ["completed"] },
  completed: { shop: [], buyer: [] },
  cancelled: { shop: [], buyer: [] },
};

/* ---------- example shops (read-only) ---------- */

const libById = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));

export const EXAMPLE_SHOPS: Shop[] = DEMO_SHOPS.map((d) => ({
  id: `example:${d.slug}`,
  ownerId: "example",
  slug: d.slug,
  name: d.name,
  about: d.about.th,
  city: d.city.th,
  tint: d.tint,
  links: { shopee: "https://shopee.co.th/", tiktok: "https://www.tiktok.com/" },
  shippingThb: 40,
  freeShippingFromThb: 300,
  productTypes: d.productTypes,
  status: "approved",
  createdAt: `${d.joined}-01T00:00:00.000Z`,
  example: true,
}));

export const EXAMPLE_PRODUCTS: Product[] = DEMO_SHOPS.flatMap((d) =>
  d.products.flatMap((p) => {
    const def = libById.get(p.stickerId);
    if (!def) return [];
    const h = Math.round(((def.widthMm * def.viewBox[1]) / def.viewBox[0]) * 10) / 10;
    return [
      {
        id: `example:${d.slug}:${p.stickerId}`,
        shopId: `example:${d.slug}`,
        name: def.name.th,
        image: stickerThumb(def),
        stickerId: p.stickerId,
        widthMm: def.widthMm,
        heightMm: h,
        priceThb: p.priceThb,
        stock: null,
        finish: p.finish,
        active: true,
        createdAt: `${d.joined}-01T00:00:00.000Z`,
      } satisfies Product,
    ];
  }),
);

/* ---------- test-mode backend (localStorage) ---------- */

type LocalData = { shops: Shop[]; products: Product[]; orders: Order[]; threads: Thread[]; messages: Message[] };
const KEY = "peelplan.market.v1";
const EVENT = "peelplan:market";
const empty = (): LocalData => ({ shops: [], products: [], orders: [], threads: [], messages: [] });

function load(): LocalData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...(JSON.parse(raw) as LocalData) } : empty();
  } catch {
    return empty();
  }
}

function save(d: LocalData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Quota: images are stored inline in test mode. Drop the oldest chat images first and retry once.
    d.messages = d.messages.map((m, i) => (i < d.messages.length / 2 ? { ...m, image: undefined } : m));
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      throw new Error("storage-full");
    }
  }
  window.dispatchEvent(new Event(EVENT));
}

function mutate<T>(fn: (d: LocalData) => T): T {
  const d = load();
  const out = fn(d);
  save(d);
  return out;
}

const allShops = (d: LocalData) => [...d.shops, ...EXAMPLE_SHOPS];
const allProducts = (d: LocalData) => [...d.products, ...EXAMPLE_PRODUCTS];

const EXAMPLE_REPLY =
  "ร้านนี้เป็นร้านตัวอย่างสำหรับทดลองระบบ ข้อความนี้ตอบกลับอัตโนมัติ / This is an example shop for testing; this reply is automatic.";

export const localStore: MarketStore = {
  async listShops() {
    return allShops(load()).filter((s) => s.status === "approved");
  },
  async getShop(slug) {
    return allShops(load()).find((s) => s.slug === slug) ?? null;
  },
  async getShopById(id) {
    return allShops(load()).find((s) => s.id === id) ?? null;
  },
  async myShop(userId) {
    return load().shops.find((s) => s.ownerId === userId) ?? null;
  },
  async saveMyShop(userId, patch) {
    return mutate((d) => {
      const taken = new Set(allShops(d).map((s) => s.slug));
      const i = d.shops.findIndex((s) => s.ownerId === userId);
      if (i >= 0) {
        // Changing the public face of an approved shop sends it back for review, as in the database.
        const prev = d.shops[i];
        const reviewed = patch.name !== undefined && patch.name !== prev.name;
        d.shops[i] = { ...prev, ...patch, status: reviewed && prev.status === "approved" ? "pending" : prev.status };
        return d.shops[i];
      }
      let slug = slugify(patch.name);
      for (let n = 2; taken.has(slug); n++) slug = `${slugify(patch.name)}-${n}`;
      const shop: Shop = {
        id: uid(),
        ownerId: userId,
        slug,
        about: "",
        city: "",
        tint: "#E8F7B0",
        links: {},
        shippingThb: 40,
        productTypes: ["die-cut"],
        createdAt: now(),
        ...patch,
        status: "pending",
      };
      d.shops.push(shop);
      return shop;
    });
  },
  async listProducts(shopId, opts) {
    return allProducts(load()).filter((p) => p.shopId === shopId && (opts?.includeInactive || p.active));
  },
  async getProducts(ids) {
    const set = new Set(ids);
    return allProducts(load()).filter((p) => set.has(p.id));
  },
  async saveProduct(shopId, product, id) {
    return mutate((d) => {
      if (id) {
        const i = d.products.findIndex((p) => p.id === id && p.shopId === shopId);
        if (i < 0) throw new Error("not-found");
        d.products[i] = { ...d.products[i], ...product };
        return d.products[i];
      }
      const p: Product = { ...product, id: uid(), shopId, createdAt: now() };
      d.products.unshift(p);
      return p;
    });
  },
  async deleteProduct(id) {
    mutate((d) => void (d.products = d.products.filter((p) => p.id !== id)));
  },

  async placeOrder({ buyerId, shopId, lines, address, note }) {
    return mutate((d) => {
      const shop = allShops(d).find((s) => s.id === shopId);
      if (!shop || shop.status !== "approved") throw new Error("shop-unavailable");
      const products = allProducts(d);
      const items = lines.map((l) => {
        const p = products.find((x) => x.id === l.productId && x.shopId === shopId && x.active);
        if (!p) throw new Error("product-unavailable");
        if (p.stock !== null && p.stock < l.qty) throw new Error("out-of-stock");
        return { productId: p.id, name: p.name, image: p.image, priceThb: p.priceThb, qty: l.qty, widthMm: p.widthMm, heightMm: p.heightMm };
      });
      // Reserve stock now; a cancelled order puts it back.
      for (const it of items) {
        const p = d.products.find((x) => x.id === it.productId);
        if (p && p.stock !== null) p.stock -= it.qty;
      }
      const subtotal = items.reduce((s, it) => s + it.priceThb * it.qty, 0);
      const shipping = shippingFor(shop, subtotal);
      const order: Order = {
        id: uid(),
        code: orderCode(),
        shopId,
        buyerId,
        items,
        subtotalThb: subtotal,
        shippingThb: shipping,
        totalThb: subtotal + shipping,
        address,
        note,
        status: "awaiting_payment",
        history: [{ status: "awaiting_payment", at: now() }],
        createdAt: now(),
      };
      d.orders.unshift(order);
      return order;
    });
  },
  async getOrder(id) {
    return load().orders.find((o) => o.id === id) ?? null;
  },
  async buyerOrders(buyerId) {
    return load().orders.filter((o) => o.buyerId === buyerId);
  },
  async shopOrders(shopId) {
    return load().orders.filter((o) => o.shopId === shopId);
  },
  async submitSlip(orderId, slip) {
    return mutate((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o || o.status !== "awaiting_payment") throw new Error("bad-state");
      o.slip = slip;
      o.status = "slip_submitted";
      o.history.push({ status: o.status, at: now() });
      return o;
    });
  },
  async setOrderStatus(orderId, status, extra) {
    return mutate((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o) throw new Error("not-found");
      o.status = status;
      if (extra?.tracking) o.tracking = extra.tracking;
      if (extra?.cancelReason) o.cancelReason = extra.cancelReason;
      // Rejecting a slip sends the order back to "awaiting payment" for a new one.
      if (status === "awaiting_payment") o.slip = undefined;
      if (status === "cancelled") {
        for (const it of o.items) {
          const p = d.products.find((x) => x.id === it.productId);
          if (p && p.stock !== null) p.stock += it.qty;
        }
      }
      o.history.push({ status, at: now() });
      return o;
    });
  },

  async openThread(shopId, buyerId, buyerName) {
    return mutate((d) => {
      const found = d.threads.find((t) => t.shopId === shopId && t.buyerId === buyerId);
      if (found) return found;
      const t: Thread = { id: uid(), shopId, buyerId, buyerName, lastAt: now(), lastText: "", unreadBuyer: 0, unreadShop: 0 };
      d.threads.unshift(t);
      return t;
    });
  },
  async getThread(id) {
    return load().threads.find((t) => t.id === id) ?? null;
  },
  async buyerThreads(buyerId) {
    return load()
      .threads.filter((t) => t.buyerId === buyerId)
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  },
  async shopThreads(shopId) {
    return load()
      .threads.filter((t) => t.shopId === shopId)
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  },
  async messages(threadId) {
    return load().messages.filter((m) => m.threadId === threadId);
  },
  async send(threadId, from, body) {
    const msg = mutate((d) => {
      const t = d.threads.find((x) => x.id === threadId);
      if (!t) throw new Error("not-found");
      const m: Message = { id: uid(), threadId, from, ...body, at: now() };
      d.messages.push(m);
      t.lastAt = m.at;
      t.lastText = body.text ?? (body.image ? "📷" : "");
      if (from === "buyer") t.unreadShop++;
      else t.unreadBuyer++;
      return m;
    });
    // Example shops answer once per thread so the buyer side can be tried alone.
    const t = await this.getThread(threadId);
    if (from === "buyer" && t?.shopId.startsWith("example:")) {
      const answered = (await this.messages(threadId)).some((m) => m.from === "shop");
      if (!answered) setTimeout(() => void this.send(threadId, "shop", { text: EXAMPLE_REPLY }), 900);
    }
    return msg;
  },
  async markRead(threadId, side) {
    const t = load().threads.find((x) => x.id === threadId);
    if (!t || (side === "buyer" ? t.unreadBuyer : t.unreadShop) === 0) return;
    mutate((d) => {
      const x = d.threads.find((y) => y.id === threadId)!;
      if (side === "buyer") x.unreadBuyer = 0;
      else x.unreadShop = 0;
    });
  },

  async approveForTesting(shopId) {
    mutate((d) => {
      const s = d.shops.find((x) => x.id === shopId);
      if (s) s.status = "approved";
    });
  },
  subscribe(cb) {
    window.addEventListener(EVENT, cb);
    const onStorage = (e: StorageEvent) => e.key === KEY && cb();
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, cb);
      window.removeEventListener("storage", onStorage);
    };
  },
};

/* ---------- picking the backend ---------- */

let supa: MarketStore | null = null;
/** The store for this build. Supabase when keys are configured, otherwise test mode. */
export async function getStore(): Promise<MarketStore> {
  if (!AUTH_ENABLED) return localStore;
  if (!supa) supa = (await import("./supabaseStore")).supabaseStore;
  return supa;
}

export const TEST_MODE = !AUTH_ENABLED;

/**
 * Load something from the store and reload whenever the store changes.
 * `deps` re-run the loader (e.g. a different id). Returns undefined while loading.
 */
export function useMarket<T>(load: (s: MarketStore) => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    void getStore().then((s) => {
      const run = () =>
        load(s).then(
          (v) => alive && setValue(v),
          () => alive && setValue(undefined),
        );
      void run();
      unsub = s.subscribe(() => void run());
    });
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/* ---------- cart (this device only, both modes) ---------- */

const CART_KEY = "peelplan.cart.v1";
const CART_EVENT = "peelplan:cart";
type CartState = { productId: string; shopId: string; qty: number }[];
let cartCache: CartState | null = null;

function readCart(): CartState {
  if (cartCache) return cartCache;
  try {
    cartCache = JSON.parse(localStorage.getItem(CART_KEY) || "[]") as CartState;
  } catch {
    cartCache = [];
  }
  return cartCache;
}
function writeCart(c: CartState) {
  cartCache = c;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(CART_EVENT));
}
const EMPTY: CartState = [];

export const cart = {
  add(productId: string, shopId: string, qty = 1) {
    const c = readCart();
    const line = c.find((l) => l.productId === productId);
    writeCart(line ? c.map((l) => (l === line ? { ...l, qty: Math.min(99, l.qty + qty) } : l)) : [...c, { productId, shopId, qty }]);
  },
  setQty(productId: string, qty: number) {
    writeCart(qty <= 0 ? readCart().filter((l) => l.productId !== productId) : readCart().map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l)));
  },
  clearShop(shopId: string) {
    writeCart(readCart().filter((l) => l.shopId !== shopId));
  },
};

export function useCart(): CartState {
  return useSyncExternalStore(
    (cb) => {
      const on = (e?: Event) => {
        if (e instanceof StorageEvent && e.key !== CART_KEY) return;
        cartCache = null;
        cb();
      };
      window.addEventListener(CART_EVENT, cb);
      window.addEventListener("storage", on);
      return () => {
        window.removeEventListener(CART_EVENT, cb);
        window.removeEventListener("storage", on);
      };
    },
    readCart,
    () => EMPTY,
  );
}

/* ---------- images (test mode keeps them inline, downscaled) ---------- */

/** Downscale an image file to a JPEG/PNG data URL no wider than `max` px. */
export function fileToDataUrl(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      // PNG keeps die-cut transparency; photos (slips) compress better as JPEG.
      resolve(file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad-image"));
    };
    img.src = url;
  });
}
