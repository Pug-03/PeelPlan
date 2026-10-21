"use client";

/**
 * Supabase backend for the marketplace (schema: supabase/migrations/0002_marketplace.sql).
 *
 * - Reads go through RLS: anyone sees approved shops (`shops_public`) and their active products;
 *   orders, threads and messages are visible only to the buyer and the shop owner.
 * - Every write with rules (orders, status changes, slips, chat) is an RPC, so the database checks
 *   stock, totals and the NEXT_STATUS matrix. Errors come back as the same short codes the
 *   test-mode store throws ('out-of-stock', 'bad-state', ...).
 * - Images given as data URLs (from fileToDataUrl) are uploaded: product/shop images to public
 *   buckets (stored as public URLs); slips and chat images to private buckets (stored as paths and
 *   read back through short-lived signed URLs).
 * - The read-only example shops are merged in so the site never looks empty. They exist only in
 *   the client, so ordering from or chatting with them throws 'shop-unavailable' here.
 */
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { EXAMPLE_PRODUCTS, EXAMPLE_SHOPS, type MarketStore } from "./store";
import {
  LINK_KINDS,
  type Address,
  type AdminShop,
  type Finish,
  type Message,
  type Order,
  type OrderStatus,
  type Product,
  type Shop,
  type ShopLinks,
  type ShopStatus,
  type Thread,
} from "./types";

/* ---------- client, errors, events ---------- */

type Client = NonNullable<ReturnType<typeof createSupabaseBrowser>>;
let client: Client | null = null;
function db(): Client {
  client ??= createSupabaseBrowser();
  if (!client) throw new Error("supabase-disabled");
  return client;
}

type Result<T> = { data: T; error: null } | { data: null; error: { message: string } };
function check<T>(res: Result<T> | { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** An RPC this database doesn't have (migration not applied yet), so the caller can do it the old way. */
function isMissingFunction(error: { code?: string; message: string }) {
  return error.code === "PGRST202" || /could not find the function|does not exist/i.test(error.message);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID.test(s);
const num = (v: unknown) => Number(v);
const optNum = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

async function currentUserId(): Promise<string | null> {
  const { data } = await db().auth.getSession();
  return data.session?.user.id ?? null;
}

const listeners = new Set<() => void>();
let pending: ReturnType<typeof setTimeout> | null = null;
/** Coalesce bursts (a status change touches orders + events + threads) into one reload. */
function emit() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    listeners.forEach((cb) => cb());
  }, 60);
}

type Channel = ReturnType<Client["channel"]>;
let channel: Channel | null = null;
function openChannel() {
  if (channel) return;
  // RLS applies to postgres_changes, so this only delivers rows the signed-in user may read.
  channel = db()
    .channel(`market-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, emit)
    .on("postgres_changes", { event: "*", schema: "public", table: "threads" }, emit)
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, emit)
    .subscribe();
}
function closeChannel() {
  if (!channel) return;
  void db().removeChannel(channel);
  channel = null;
}

/* ---------- images ---------- */

type PublicBucket = "product-images" | "shop-images";
type PrivateBucket = "slips" | "chat-images";
type Bucket = PublicBucket | PrivateBucket;

const isRasterDataUrl = (s: string | undefined): s is string => !!s && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(s);

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(",", 2);
  const type = /^data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type === "image/jpg" ? "image/jpeg" : type });
}

/** Upload a data URL to `<bucket>/<folder>/<random>.<ext>` and return the storage path. */
async function upload(bucket: Bucket, folder: string, dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  check(await db().storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false }));
  return path;
}

/** Public-bucket image: upload data URLs, keep URLs / site paths / inline SVG as they are. */
async function publicImage(bucket: PublicBucket, shopId: string, value: string): Promise<string> {
  if (!isRasterDataUrl(value)) return value;
  const path = await upload(bucket, shopId, value);
  return db().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Signed URLs are cached so reloads keep the same URL (no image flicker / re-download).
const signed = new Map<string, { url: string; until: number }>();
const SIGN_SECONDS = 3600;
async function sign(bucket: PrivateBucket, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const need: string[] = [];
  for (const p of new Set(paths.filter((x): x is string => !!x))) {
    const hit = signed.get(`${bucket}/${p}`);
    if (hit && hit.until > Date.now() + 5 * 60_000) out.set(p, hit.url);
    else need.push(p);
  }
  if (need.length) {
    const { data } = await db().storage.from(bucket).createSignedUrls(need, SIGN_SECONDS);
    for (const d of data ?? []) {
      if (!d.path || !d.signedUrl) continue;
      out.set(d.path, d.signedUrl);
      signed.set(`${bucket}/${d.path}`, { url: d.signedUrl, until: Date.now() + SIGN_SECONDS * 1000 });
    }
  }
  return out;
}

/* ---------- rows <-> types ---------- */

type ShopRow = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string;
  city: string;
  tint: string;
  logo_url: string | null;
  cover_url: string | null;
  links: ShopLinks | null;
  promptpay_id: string | null;
  promptpay_name: string | null;
  shipping_thb: number | string;
  free_shipping_from_thb: number | string | null;
  product_types: string[];
  status: ShopStatus;
  /** Added in 0003: staff's reason for rejecting / pausing, readable by the owner. */
  status_reason?: string | null;
  created_at: string;
};
/** shops_public: no owner identity, no PromptPay. `accepts_payment` arrives with 0004. */
type PublicShopRow = Omit<ShopRow, "owner_id" | "description" | "promptpay_id" | "promptpay_name" | "status" | "status_reason"> & {
  about: string;
  accepts_payment?: boolean | null;
};

const SHOP_COLS =
  "id, owner_id, slug, name, description, city, tint, logo_url, cover_url, links, promptpay_id, promptpay_name, shipping_thb, free_shipping_from_thb, product_types, status, status_reason, created_at";

function toShop(r: ShopRow | PublicShopRow): Shop {
  const own = "owner_id" in r ? r : null;
  return {
    id: r.id,
    ownerId: own?.owner_id ?? "",
    slug: r.slug,
    name: r.name,
    about: own ? own.description : (r as PublicShopRow).about,
    city: r.city,
    tint: r.tint,
    logo: r.logo_url ?? undefined,
    cover: r.cover_url ?? undefined,
    links: r.links ?? {},
    promptpay: own?.promptpay_id ? { id: own.promptpay_id, name: own.promptpay_name ?? "" } : undefined,
    shippingThb: num(r.shipping_thb),
    freeShippingFromThb: optNum(r.free_shipping_from_thb),
    productTypes: r.product_types,
    status: own ? own.status : "approved",
    statusReason: own?.status_reason ?? undefined,
    createdAt: r.created_at,
    // Before 0004 the view has no such column: leave it unknown (treated as accepting).
    acceptsPayment: own ? own.status === "approved" && !!own.promptpay_id : ((r as PublicShopRow).accepts_payment ?? undefined),
  };
}

type ProductRow = {
  id: string;
  shop_id: string;
  name: string;
  image_url: string;
  sticker_id: string | null;
  width_mm: number | string;
  height_mm: number | string;
  price_thb: number | string;
  stock: number | null;
  finish: Finish;
  active: boolean;
  created_at: string;
};

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  shopId: r.shop_id,
  name: r.name,
  image: r.image_url,
  stickerId: r.sticker_id ?? undefined,
  widthMm: num(r.width_mm),
  heightMm: num(r.height_mm),
  priceThb: num(r.price_thb),
  stock: r.stock,
  finish: r.finish,
  active: r.active,
  createdAt: r.created_at,
});

type OrderRow = {
  id: string;
  code: string;
  shop_id: string | null;
  buyer_id: string | null;
  subtotal_thb: number | string;
  shipping_thb: number | string;
  total_thb: number | string;
  address: Address;
  note: string;
  status: OrderStatus;
  slip_path: string | null;
  tracking: Order["tracking"] | null;
  cancel_reason: string | null;
  /** Captured by place_order from 0004 on; absent / null on older rows. */
  promptpay_id?: string | null;
  promptpay_name?: string | null;
  created_at: string;
  order_items: {
    id: number;
    product_id: string | null;
    name: string;
    image_url: string;
    price_thb: number | string;
    qty: number;
    width_mm: number | string;
    height_mm: number | string;
  }[];
  order_events: { id: number; status: OrderStatus; at: string }[];
};
const ORDER_COLS = "*, order_items(*), order_events(id, status, at)";

function toOrder(r: OrderRow, slips: Map<string, string>): Order {
  return {
    id: r.id,
    code: r.code,
    shopId: r.shop_id ?? "",
    buyerId: r.buyer_id ?? "",
    items: [...r.order_items]
      .sort((a, b) => a.id - b.id)
      .map((i) => ({
        productId: i.product_id ?? "",
        name: i.name,
        image: i.image_url,
        priceThb: num(i.price_thb),
        qty: i.qty,
        widthMm: num(i.width_mm),
        heightMm: num(i.height_mm),
      })),
    subtotalThb: num(r.subtotal_thb),
    shippingThb: num(r.shipping_thb),
    totalThb: num(r.total_thb),
    address: r.address,
    note: r.note,
    status: r.status,
    slip: r.slip_path ? slips.get(r.slip_path) : undefined,
    tracking: r.tracking ?? undefined,
    cancelReason: r.cancel_reason ?? undefined,
    promptpay: r.promptpay_id ? { id: r.promptpay_id, name: r.promptpay_name ?? "" } : undefined,
    history: [...r.order_events].sort((a, b) => a.id - b.id).map((e) => ({ status: e.status, at: e.at })),
    createdAt: r.created_at,
  };
}

async function toOrders(rows: OrderRow[]): Promise<Order[]> {
  const slips = await sign(
    "slips",
    rows.map((r) => r.slip_path),
  );
  return rows.map((r) => toOrder(r, slips));
}

type ThreadRow = {
  id: string;
  shop_id: string;
  buyer_id: string;
  buyer_name: string;
  last_at: string;
  last_text: string;
  unread_buyer: number;
  unread_shop: number;
};
const toThread = (r: ThreadRow): Thread => ({
  id: r.id,
  shopId: r.shop_id,
  buyerId: r.buyer_id,
  buyerName: r.buyer_name,
  lastAt: r.last_at,
  lastText: r.last_text,
  unreadBuyer: r.unread_buyer,
  unreadShop: r.unread_shop,
});

type MessageRow = {
  id: string;
  thread_id: string;
  sender: Message["from"];
  body: string | null;
  image_path: string | null;
  order_id: string | null;
  created_at: string;
};
async function toMessages(rows: MessageRow[]): Promise<Message[]> {
  const images = await sign(
    "chat-images",
    rows.map((r) => r.image_path),
  );
  return rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    from: r.sender,
    text: r.body ?? undefined,
    image: r.image_path ? images.get(r.image_path) : undefined,
    orderId: r.order_id ?? undefined,
    at: r.created_at,
  }));
}

/* ---------- shop helpers ---------- */

async function ownShopRow(userId: string | null, filter?: { col: "id" | "slug"; value: string }): Promise<ShopRow | null> {
  if (!userId) return null;
  let q = db().from("shops").select(SHOP_COLS).eq("owner_id", userId);
  if (filter) q = q.eq(filter.col, filter.value);
  return check(await q.maybeSingle()) as ShopRow | null;
}

/** A public shop plus its PromptPay details when the viewer has an unpaid order there. */
async function publicShop(col: "id" | "slug", value: string): Promise<Shop | null> {
  const uid = await currentUserId();
  const own = await ownShopRow(uid, { col, value });
  if (own) return toShop(own);
  const row = check(await db().from("shops_public").select("*").eq(col, value).maybeSingle()) as PublicShopRow | null;
  if (!row) return null;
  const shop = toShop(row);
  if (uid) {
    const { data } = await db().rpc("shop_payment_info", { p_shop_id: shop.id });
    const pp = data as { id: string; name: string } | null;
    if (pp?.id) shop.promptpay = { id: pp.id, name: pp.name };
  }
  return shop;
}

const cleanLinks = (links: ShopLinks) => Object.fromEntries(LINK_KINDS.flatMap((k) => (links[k]?.trim() ? [[k, links[k]!.trim()]] : [])));

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ---------- the store ---------- */

export const supabaseStore: MarketStore = {
  async listShops() {
    const rows = check(await db().from("shops_public").select("*").order("created_at", { ascending: false })) as PublicShopRow[];
    return [...rows.map(toShop), ...EXAMPLE_SHOPS];
  },
  async getShop(slug) {
    return (await publicShop("slug", slug)) ?? EXAMPLE_SHOPS.find((s) => s.slug === slug) ?? null;
  },
  async getShopById(id) {
    if (!isUuid(id)) return EXAMPLE_SHOPS.find((s) => s.id === id) ?? null;
    return publicShop("id", id);
  },
  async myShop(userId) {
    const row = await ownShopRow(userId);
    return row ? toShop(row) : null;
  },
  async saveMyShop(userId, patch) {
    let row = await ownShopRow(userId);
    if (!row) row = check(await db().rpc("create_my_shop", { p_name: patch.name, p_product_types: patch.productTypes ?? null })) as ShopRow;

    // Only send what changed: editing name/about/types of an approved shop sends it back to review.
    const upd: Record<string, unknown> = {};
    if (patch.name.trim() !== row.name) upd.name = patch.name.trim();
    if (patch.about !== undefined && patch.about !== row.description) upd.description = patch.about;
    if (patch.productTypes && !sameList(patch.productTypes, row.product_types)) upd.product_types = patch.productTypes;
    if (patch.slug !== undefined && patch.slug !== row.slug) upd.slug = patch.slug;
    if (patch.city !== undefined) upd.city = patch.city;
    if (patch.tint !== undefined) upd.tint = patch.tint;
    if (patch.links !== undefined) upd.links = cleanLinks(patch.links);
    if ("promptpay" in patch) {
      const id = patch.promptpay?.id.replace(/\D/g, "") ?? "";
      upd.promptpay_id = id || null;
      upd.promptpay_name = id ? patch.promptpay!.name.trim() : null;
    }
    if (patch.shippingThb !== undefined) upd.shipping_thb = patch.shippingThb;
    if ("freeShippingFromThb" in patch) upd.free_shipping_from_thb = patch.freeShippingFromThb || null;
    if ("logo" in patch) upd.logo_url = patch.logo ? await publicImage("shop-images", row.id, patch.logo) : null;
    if ("cover" in patch) upd.cover_url = patch.cover ? await publicImage("shop-images", row.id, patch.cover) : null;

    if (Object.keys(upd).length) row = check(await db().from("shops").update(upd).eq("id", row.id).select(SHOP_COLS).single()) as ShopRow;
    emit();
    return toShop(row);
  },

  async listProducts(shopId, opts) {
    if (!isUuid(shopId)) return EXAMPLE_PRODUCTS.filter((p) => p.shopId === shopId && (opts?.includeInactive || p.active));
    let q = db().from("products").select("*").eq("shop_id", shopId);
    if (!opts?.includeInactive) q = q.eq("active", true);
    return (check(await q.order("created_at", { ascending: false })) as ProductRow[]).map(toProduct);
  },
  async getProducts(ids) {
    const real = ids.filter(isUuid);
    const set = new Set(ids);
    const rows = real.length ? (check(await db().from("products").select("*").in("id", real)) as ProductRow[]) : [];
    return [...rows.map(toProduct), ...EXAMPLE_PRODUCTS.filter((p) => set.has(p.id))];
  },
  async saveProduct(shopId, product, id) {
    const fields = {
      name: product.name.trim(),
      image_url: await publicImage("product-images", shopId, product.image),
      sticker_id: product.stickerId ?? null,
      width_mm: product.widthMm,
      height_mm: product.heightMm,
      price_thb: product.priceThb,
      stock: product.stock,
      finish: product.finish,
      active: product.active,
    };
    const row = id
      ? check(await db().from("products").update(fields).eq("id", id).eq("shop_id", shopId).select("*").maybeSingle())
      : check(
          await db()
            .from("products")
            .insert({ ...fields, shop_id: shopId })
            .select("*")
            .single(),
        );
    if (!row) throw new Error("not-found");
    emit();
    return toProduct(row as ProductRow);
  },
  async deleteProduct(id) {
    // Past orders keep their snapshot; the uploaded image stays in storage (they may still show it).
    if (!isUuid(id)) throw new Error("not-found");
    check(await db().from("products").delete().eq("id", id));
    emit();
  },

  async placeOrder({ shopId, lines, address, note }) {
    if (!isUuid(shopId)) throw new Error("shop-unavailable");
    const row = check(await db().rpc("place_order", { p_shop_id: shopId, p_lines: lines, p_address: address, p_note: note })) as { id: string };
    emit();
    const order = await this.getOrder(row.id);
    if (!order) throw new Error("not-found");
    return order;
  },
  async getOrder(id) {
    if (!isUuid(id)) return null;
    const row = check(await db().from("orders").select(ORDER_COLS).eq("id", id).maybeSingle()) as OrderRow | null;
    return row ? (await toOrders([row]))[0] : null;
  },
  async buyerOrders(buyerId) {
    if (!isUuid(buyerId)) return [];
    return toOrders(check(await db().from("orders").select(ORDER_COLS).eq("buyer_id", buyerId).order("created_at", { ascending: false })) as OrderRow[]);
  },
  async shopOrders(shopId) {
    if (!isUuid(shopId)) return [];
    return toOrders(check(await db().from("orders").select(ORDER_COLS).eq("shop_id", shopId).order("created_at", { ascending: false })) as OrderRow[]);
  },
  async submitSlip(orderId, slip) {
    if (!isUuid(orderId)) throw new Error("not-found");
    let path = slip;
    if (isRasterDataUrl(slip)) {
      try {
        path = await upload("slips", orderId, slip);
      } catch (e) {
        // 0004: storage only takes a slip while the order awaits payment; RLS refuses it otherwise.
        const msg = e instanceof Error ? e.message : "";
        throw new Error(/row-level security|security policy|unauthorized|403/i.test(msg) ? "bad-state" : msg);
      }
    }
    check(await db().rpc("submit_slip", { p_order_id: orderId, p_slip_path: path }));
    emit();
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("not-found");
    return order;
  },
  async setOrderStatus(orderId, status, extra) {
    if (!isUuid(orderId)) throw new Error("not-found");
    check(
      await db().rpc("set_order_status", {
        p_order_id: orderId,
        p_status: status,
        p_tracking: extra?.tracking ?? null,
        p_cancel_reason: extra?.cancelReason ?? null,
      }),
    );
    emit();
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("not-found");
    return order;
  },

  async openThread(shopId, _buyerId, buyerName) {
    if (!isUuid(shopId)) throw new Error("shop-unavailable");
    const row = check(await db().rpc("open_thread", { p_shop_id: shopId, p_buyer_name: buyerName })) as ThreadRow;
    emit();
    return toThread(row);
  },
  async getThread(id) {
    if (!isUuid(id)) return null;
    const row = check(await db().from("threads").select("*").eq("id", id).maybeSingle()) as ThreadRow | null;
    return row ? toThread(row) : null;
  },
  async buyerThreads(buyerId) {
    if (!isUuid(buyerId)) return [];
    return (check(await db().from("threads").select("*").eq("buyer_id", buyerId).order("last_at", { ascending: false })) as ThreadRow[]).map(toThread);
  },
  async shopThreads(shopId) {
    if (!isUuid(shopId)) return [];
    return (check(await db().from("threads").select("*").eq("shop_id", shopId).order("last_at", { ascending: false })) as ThreadRow[]).map(toThread);
  },
  async messages(threadId) {
    if (!isUuid(threadId)) return [];
    return toMessages(check(await db().from("messages").select("*").eq("thread_id", threadId).order("created_at")) as MessageRow[]);
  },
  async send(threadId, from, body) {
    if (!isUuid(threadId)) throw new Error("not-found");
    const imagePath = isRasterDataUrl(body.image) ? await upload("chat-images", threadId, body.image) : null;
    const row = check(
      await db().rpc("send_message", {
        p_thread_id: threadId,
        p_from: from,
        p_text: body.text ?? null,
        p_image_path: imagePath,
        p_order_id: body.orderId ?? null,
      }),
    ) as MessageRow;
    emit();
    return (await toMessages([row]))[0];
  },
  async markRead(threadId, side) {
    if (!isUuid(threadId)) return;
    check(await db().rpc("mark_thread_read", { p_thread_id: threadId, p_side: side }));
    emit();
  },

  async reportThread(threadId, reason, note) {
    if (!isUuid(threadId)) throw new Error("not-found");
    const clean = note.slice(0, 1000);
    // file_report (0005) validates the reason, snapshots the conversation for staff and returns the
    // report id. Older databases don't have it, and 0005 keeps the plain insert working on purpose,
    // so fall back to it; either path can answer 'already-reported' or 'rate-limited'.
    const { error } = await db().rpc("file_report", { p_thread_id: threadId, p_reason: reason, p_note: clean });
    if (!error) return;
    if (!isMissingFunction(error)) throw new Error(error.message);
    // Insert only (no .select()): reporters have no read access to reports.
    check(await db().from("reports").insert({ thread_id: threadId, reason, note: clean }));
  },

  // approveForTesting: intentionally absent. Shops are approved by staff (admin page / service role).

  async listAllShops() {
    // Admin-only RPC (raises 'not-admin' otherwise); returns every shop with owner name and counts.
    // 0005 stopped sending PromptPay numbers to the browser: `has_promptpay` says yes/no instead, and
    // `owner_suspended` says whether the owner's account is suspended. Both are missing before 0005.
    type Row = ShopRow & {
      owner_name: string;
      product_count: number;
      order_count: number;
      recent_order_count: number;
      has_promptpay?: boolean;
      owner_suspended?: boolean;
    };
    const rows = (check(await db().rpc("admin_list_shops")) as Row[] | null) ?? [];
    const real: AdminShop[] = rows.map((r) => {
      const hasPromptPay = r.has_promptpay ?? !!r.promptpay_id;
      return {
        ...toShop(r),
        // Staff see whether there is an account, never the number (it is often a national ID).
        promptpay: undefined,
        hasPromptPay,
        ownerSuspended: r.owner_suspended ?? false,
        acceptsPayment: r.status === "approved" && hasPromptPay,
        ownerName: r.owner_name,
        productCount: num(r.product_count),
        orderCount: num(r.order_count),
        recentOrderCount: num(r.recent_order_count),
      };
    });
    const examples: AdminShop[] = EXAMPLE_SHOPS.map((s) => ({
      ...s,
      promptpay: undefined,
      hasPromptPay: !!s.promptpay?.id,
      ownerSuspended: false,
      ownerName: "PeelPlan",
      productCount: EXAMPLE_PRODUCTS.filter((p) => p.shopId === s.id).length,
      orderCount: 0,
      recentOrderCount: 0,
    }));
    return [...real, ...examples];
  },
  async setShopStatus(shopId, status, reason) {
    if (!isUuid(shopId)) throw new Error("not-found");
    check(await db().rpc("set_shop_status", { p_shop_id: shopId, p_status: status, p_reason: reason?.trim() || null }));
    emit();
  },
  async setUserSuspended(userId, suspended, reason) {
    if (!isUuid(userId)) throw new Error("not-found");
    const { error } = await db().rpc("set_user_suspended", { p_user_id: userId, p_suspended: suspended, p_reason: reason?.trim() || null });
    // Before 0005 there is no such RPC: say so instead of looking as if it worked.
    if (error) throw new Error(isMissingFunction(error) ? "unsupported" : error.message);
    emit();
  },

  subscribe(cb) {
    listeners.add(cb);
    openChannel();
    return () => {
      listeners.delete(cb);
      if (!listeners.size) closeChannel();
    };
  },
};
