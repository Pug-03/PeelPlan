"use client";

/**
 * Marketplace data access. One interface, two backends:
 * - Test mode (no Supabase keys): everything lives in this browser's localStorage, so the whole
 *   buy → pay → ship → chat loop can be tried on one device. The example shops are read-only and
 *   answer chats with a canned reply; they never show a payable QR.
 * - Supabase: see ./supabaseStore.ts (same interface, backed by migration 0002).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { DEMO_SHOPS } from "@/config/demoShops";
import { AUTH_ENABLED } from "@/lib/supabase/config";
import { VISIBLE_LIBRARY, stickerThumb } from "@/stickers/library";
import type { Address, AdminShop, Message, Order, OrderStatus, Product, Shop, ShopStatus, Thread } from "./types";

export type ReportReason = "spam" | "scam" | "harassment" | "counterfeit" | "other";
export type NewProduct = Omit<Product, "id" | "shopId" | "createdAt">;
export type ShopPatch = Partial<Omit<Shop, "id" | "ownerId" | "status" | "statusReason" | "createdAt" | "example">>;

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
  /** `side` is who is acting: only the moves NEXT_STATUS allows that side go through (checked again in the database). */
  setOrderStatus(orderId: string, status: OrderStatus, extra: { side: "buyer" | "shop"; tracking?: Order["tracking"]; cancelReason?: string }): Promise<Order>;

  openThread(shopId: string, buyerId: string, buyerName: string): Promise<Thread>;
  getThread(id: string): Promise<Thread | null>;
  buyerThreads(buyerId: string): Promise<Thread[]>;
  shopThreads(shopId: string): Promise<Thread[]>;
  messages(threadId: string): Promise<Message[]>;
  send(threadId: string, from: "buyer" | "shop", body: { text?: string; image?: string; orderId?: string }): Promise<Message>;
  markRead(threadId: string, side: "buyer" | "shop"): Promise<void>;

  /** Supabase only: report a chat to staff. Reasons are the database's (0002 `reports.reason`). */
  reportThread?(threadId: string, reason: ReportReason, note: string): Promise<void>;

  /** Test mode only: let the tester approve their own pending shop. */
  approveForTesting?(shopId: string): Promise<void>;

  /* Admin (optional so older/partial backends still type-check; both built-in backends implement them). */
  /** Every shop in any status, newest first. Supabase: admins only (RPC admin_list_shops). */
  listAllShops?(): Promise<AdminShop[]>;
  /** Approve / reject / send back to review. `reason` is shown to the seller (required to reject). */
  setShopStatus?(shopId: string, status: ShopStatus, reason?: string): Promise<void>;
  /**
   * Suspend (or un-suspend) an account: it keeps reading and can settle open orders, but can't order,
   * chat or open a shop. Supabase 0005 only; throws 'unsupported' on an older database.
   */
  setUserSuspended?(userId: string, suspended: boolean, reason?: string): Promise<void>;
  /** Fires after any change, so views can reload. */
  subscribe(cb: () => void): () => void;
}

/* ---------- helpers shared by both backends ---------- */

/**
 * URL slug that keeps letters in any script (Thai shop names stay readable, Latin accents are
 * dropped). A name with no letters or digits at all gets a short random slug instead of "shop".
 */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
    .replace(/-$/, "") || `shop-${Math.random().toString(36).slice(2, 8)}`;

/** Example shops are client-only: with a real backend they can't take orders or chats. */
export const isReadOnlyExample = (shop: Pick<Shop, "example"> | null | undefined) => !!shop?.example && !AUTH_ENABLED;
/** Whether checkout can go ahead for this shop. `acceptsPayment` missing (older database) counts as yes. */
export const canCheckout = (shop: Pick<Shop, "status" | "example" | "acceptsPayment">) =>
  shop.status === "approved" && shop.acceptsPayment !== false && !isReadOnlyExample(shop);

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const orderCode = () => `PP-${Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("")}`;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();

export function shippingFor(shop: Pick<Shop, "shippingThb" | "freeShippingFromThb">, subtotal: number) {
  return shop.freeShippingFromThb && subtotal >= shop.freeShippingFromThb ? 0 : shop.shippingThb;
}

/**
 * Edits an approved shop can't make on its own: the database (0004 `check_shop_rules`) puts the shop
 * back to `pending` when the name, the about text, the product types or the PromptPay account change.
 */
export function sendsBackToReview(patch: ShopPatch, shop: Pick<Shop, "name" | "about" | "productTypes" | "promptpay">) {
  const pp = (p: Shop["promptpay"]) => `${p?.id ?? ""}|${p?.name ?? ""}`;
  return (
    (patch.name !== undefined && patch.name !== shop.name) ||
    (patch.about !== undefined && patch.about !== shop.about) ||
    (patch.productTypes !== undefined && patch.productTypes.join("\u0000") !== shop.productTypes.join("\u0000")) ||
    ("promptpay" in patch && pp(patch.promptpay) !== pp(shop.promptpay))
  );
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

/** Test mode keeps one simulated account per browser: its name is the only owner name we know. */
function localOwnerNames(): Map<string, string> {
  try {
    const s = JSON.parse(localStorage.getItem("peelplan.session.v1") || "null") as {
      user?: { id: string; name: string };
      profile?: { displayName?: string; shop?: { ownerName?: string } } | null;
    } | null;
    if (!s?.user?.id) return new Map();
    return new Map([[s.user.id, s.profile?.shop?.ownerName || s.profile?.displayName || s.user.name]]);
  } catch {
    return new Map();
  }
}

const EXAMPLE_REPLY = "ร้านนี้เป็นร้านตัวอย่างสำหรับทดลองระบบ ข้อความนี้ตอบกลับอัตโนมัติ / This is an example shop for testing; this reply is automatic.";

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
      // "preview" is the seller preview route (/shops/preview), not a shop.
      const taken = new Set([...allShops(d).map((s) => s.slug), "preview"]);
      const i = d.shops.findIndex((s) => s.ownerId === userId);
      if (i >= 0) {
        // Changing the public face or the payment details of an approved shop sends it back for
        // review, as in the database (0004 check_shop_rules): name, about, types and PromptPay.
        const prev = d.shops[i];
        const reviewed = sendsBackToReview(patch, prev);
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
      // Same cap as the database (0004): one order can't reserve a shop's whole stock.
      if (items.reduce((n, it) => n + it.qty, 0) > 200) throw new Error("too-many-units");
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
      // A stale tab must not push an order into an impossible state (the database checks this too).
      if (!NEXT_STATUS[o.status][extra.side].includes(status)) throw new Error("bad-state");
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
      if (s) {
        s.status = "approved";
        delete s.statusReason;
      }
    });
  },

  async listAllShops() {
    const d = load();
    const owner = localOwnerNames();
    const monthAgo = Date.now() - 30 * 86_400_000;
    return [...d.shops]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .concat(EXAMPLE_SHOPS)
      .map((s) => {
        const orders = d.orders.filter((o) => o.shopId === s.id);
        return {
          ...s,
          ownerName: s.example ? "PeelPlan" : (owner.get(s.ownerId) ?? ""),
          // As in Supabase mode (0005): the admin list says whether there is a PromptPay, not what it is.
          promptpay: undefined,
          hasPromptPay: !!s.promptpay?.id,
          // Test mode has one simulated account on the device, so there is nothing to suspend.
          ownerSuspended: false,
          productCount: allProducts(d).filter((p) => p.shopId === s.id).length,
          orderCount: orders.length,
          recentOrderCount: orders.filter((o) => Date.parse(o.createdAt) >= monthAgo).length,
        };
      });
  },
  async setShopStatus(shopId, status, reason) {
    const why = reason?.trim().slice(0, 500) || undefined;
    if (status === "rejected" && !why) throw new Error("reason-required");
    mutate((d) => {
      const s = d.shops.find((x) => x.id === shopId);
      if (!s) throw new Error("not-found");
      s.status = status;
      if (status === "approved" || !why) delete s.statusReason;
      else s.statusReason = why;
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

export type MarketQuery<T> = {
  /** Last loaded value; undefined until the first load succeeds. */
  data: T | undefined;
  /** The last load failed (data, if any, is from an earlier load). */
  error: boolean;
  retry: () => void;
};

/**
 * Load something from the store and reload whenever the store changes.
 * `deps` re-run the loader (e.g. a different id). Failures surface as `error` with a `retry`.
 */
export function useMarketQuery<T>(load: (s: MarketStore) => Promise<T>, deps: unknown[]): MarketQuery<T> {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    const fail = () => alive && setError(true);
    getStore().then((s) => {
      // Unmounted while the store module loaded: don't leave a listener (and realtime channel) behind.
      if (!alive) return;
      const run = () =>
        load(s).then((v) => {
          if (!alive) return;
          setValue(v);
          setError(false);
        }, fail);
      void run();
      unsub = s.subscribe(() => void run());
    }, fail);
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  const retry = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);
  return { data: value, error, retry };
}

/** Like useMarketQuery, value only: undefined while loading (and after a failed first load). */
export function useMarket<T>(load: (s: MarketStore) => Promise<T>, deps: unknown[]): T | undefined {
  return useMarketQuery(load, deps).data;
}

/* ---------- cart (this device, per signed-in account; both modes) ---------- */

const CART_KEY = "peelplan.cart.v1";
const CART_EVENT = "peelplan:cart";
type CartState = { productId: string; shopId: string; qty: number }[];
let cartCache: CartState | null = null;

/**
 * Whose cart is showing. Signed in: `peelplan.cart.v1:<userId>`, so the next person on this device
 * doesn't see (or check out) it. Signed out: the unkeyed cart, merged into the account on sign-in so
 * items picked before signing in survive the trip through /login.
 * `undefined` until the session is known (Supabase reads it asynchronously).
 */
let cartOwner: string | null | undefined;
let watchingOwner = false;
const cartKey = () => (cartOwner ? `${CART_KEY}:${cartOwner}` : CART_KEY);

function readKey(key: string): CartState {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]") as unknown;
    return Array.isArray(v) ? (v as CartState) : [];
  } catch {
    return [];
  }
}

function setCartOwner(id: string | null, notify = true) {
  if (id === cartOwner) return;
  const was = cartOwner;
  cartOwner = id;
  cartCache = null;
  if (id && !was) {
    const anon = readKey(CART_KEY);
    if (anon.length) {
      const mine = readKey(cartKey());
      for (const l of anon) {
        const hit = mine.find((m) => m.productId === l.productId);
        if (hit) hit.qty = Math.min(99, Math.max(hit.qty, l.qty));
        else mine.push(l);
      }
      try {
        localStorage.setItem(cartKey(), JSON.stringify(mine));
        localStorage.removeItem(CART_KEY);
      } catch {
        /* storage unavailable */
      }
    }
  }
  if (notify) window.dispatchEvent(new Event(CART_EVENT));
}

/** Follow sign-in / sign-out without depending on any component being mounted. */
function watchCartOwner() {
  if (watchingOwner || typeof window === "undefined") return;
  watchingOwner = true;
  if (!AUTH_ENABLED) {
    // Test mode: the simulated account lives in localStorage (see src/lib/session.ts). The first
    // read is synchronous and silent, since it can happen while React reads the snapshot.
    const fromDemo = (notify = true) => {
      let id: string | null = null;
      try {
        id = (JSON.parse(localStorage.getItem("peelplan.session.v1") || "null") as { user?: { id?: string } } | null)?.user?.id ?? null;
      } catch {
        /* storage unavailable: signed out */
      }
      setCartOwner(id, notify);
    };
    fromDemo(false);
    window.addEventListener("peelplan:session", () => fromDemo());
    window.addEventListener("storage", (e) => e.key === "peelplan.session.v1" && fromDemo());
    return;
  }
  // Nobody signed in: skip the auth client entirely. Signing in is a full page load through
  // /auth/callback, so the cookie is already there the next time the cart is read.
  if (!document.cookie.includes("sb-")) return setCartOwner(null, false);
  void import("@/lib/supabase/client")
    .then(async ({ createSupabaseBrowser }) => {
      const sb = createSupabaseBrowser();
      if (!sb) return setCartOwner(null);
      const { data } = await sb.auth.getSession();
      setCartOwner(data.session?.user.id ?? null);
      sb.auth.onAuthStateChange((_e, session) => setCartOwner(session?.user.id ?? null));
    })
    .catch(() => setCartOwner(null));
}

function readCart(): CartState {
  watchCartOwner();
  if (cartOwner === undefined) return EMPTY;
  cartCache ??= readKey(cartKey());
  return cartCache;
}
function writeCart(c: CartState) {
  cartCache = c;
  try {
    localStorage.setItem(cartKey(), JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(CART_EVENT));
}
const EMPTY: CartState = [];

/** For changes: before the owner is known, edit the signed-out cart (it merges in on sign-in). */
const currentCart = () => {
  watchCartOwner();
  return cartOwner === undefined ? readKey(CART_KEY) : readCart();
};

export const cart = {
  add(productId: string, shopId: string, qty = 1) {
    const c = currentCart();
    const line = c.find((l) => l.productId === productId);
    writeCart(line ? c.map((l) => (l === line ? { ...l, qty: Math.min(99, l.qty + qty) } : l)) : [...c, { productId, shopId, qty }]);
  },
  setQty(productId: string, qty: number) {
    const c = currentCart();
    writeCart(qty <= 0 ? c.filter((l) => l.productId !== productId) : c.map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l)));
  },
  clearShop(shopId: string) {
    writeCart(currentCart().filter((l) => l.shopId !== shopId));
  },
};

const subscribeCart = (cb: () => void) => {
  watchCartOwner();
  const on = (e?: Event) => {
    if (e instanceof StorageEvent && e.key !== cartKey()) return;
    cartCache = null;
    cb();
  };
  window.addEventListener(CART_EVENT, cb);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(CART_EVENT, cb);
    window.removeEventListener("storage", on);
  };
};

function cartReadySnapshot() {
  watchCartOwner();
  return cartOwner !== undefined;
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribeCart, readCart, () => EMPTY);
}

/** False until we know whose cart to show (pages show a skeleton instead of a flash of "empty"). */
export function useCartReady(): boolean {
  return useSyncExternalStore(subscribeCart, cartReadySnapshot, () => false);
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
