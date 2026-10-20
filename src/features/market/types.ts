/**
 * Marketplace data model (Phase 3). Payment model: buyers pay the shop directly by PromptPay and
 * upload the transfer slip; PeelPlan never holds the money. Shops can also link out to their own
 * TikTok Shop / Shopee / Lazada pages. Mirrors supabase/migrations/0002_marketplace.sql.
 */

export type ShopStatus = "pending" | "approved" | "rejected";

export const LINK_KINDS = ["tiktok", "shopee", "lazada", "instagram", "facebook", "line"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export type ShopLinks = Partial<Record<LinkKind, string>>;

export type PromptPay = {
  /** Thai mobile number (10 digits) or national ID / tax ID (13 digits). */
  id: string;
  /** Account name the buyer should see in their banking app, to check before paying. */
  name: string;
};

export type Shop = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  about: string;
  city: string;
  tint: string;
  /** Image URL (or data URL in test mode). */
  logo?: string;
  cover?: string;
  links: ShopLinks;
  promptpay?: PromptPay;
  /** Flat shipping per order, in THB. */
  shippingThb: number;
  /** Free shipping when the subtotal reaches this (THB); empty = never. */
  freeShippingFromThb?: number;
  productTypes: string[];
  status: ShopStatus;
  /** Why staff rejected (or paused) the shop; shown to the seller. */
  statusReason?: string;
  createdAt: string;
  /** Built-in example shop: read-only, cannot receive real payments. */
  example?: boolean;
};

/** A shop as the admin sees it: owner's name and a few counts for review. */
export type AdminShop = Shop & {
  ownerName: string;
  productCount: number;
  orderCount: number;
  /** Orders placed in the last 30 days. */
  recentOrderCount: number;
};

export const FINISHES = ["glossy", "matte", "clear", "holo"] as const;
export type Finish = (typeof FINISHES)[number];

export type Product = {
  id: string;
  shopId: string;
  name: string;
  /** Image URL or data URL. Library stickers use their own artwork. */
  image: string;
  /** Library sticker this listing is, so it can be tried on the lid in the editor. */
  stickerId?: string;
  widthMm: number;
  heightMm: number;
  priceThb: number;
  /** null = made to order (no stock limit). */
  stock: number | null;
  finish: Finish;
  active: boolean;
  createdAt: string;
};

export type Address = {
  name: string;
  phone: string;
  line1: string;
  district: string;
  province: string;
  postcode: string;
};

export type OrderStatus = "awaiting_payment" | "slip_submitted" | "paid" | "shipped" | "completed" | "cancelled";

export type OrderItem = {
  productId: string;
  name: string;
  image: string;
  priceThb: number;
  qty: number;
  widthMm: number;
  heightMm: number;
};

export type Order = {
  id: string;
  /** Short human code shown to both sides, e.g. PP-7K3D9Q. */
  code: string;
  shopId: string;
  buyerId: string;
  items: OrderItem[];
  subtotalThb: number;
  shippingThb: number;
  totalThb: number;
  address: Address;
  note: string;
  status: OrderStatus;
  slip?: string;
  tracking?: { carrier: string; number: string };
  cancelReason?: string;
  history: { status: OrderStatus; at: string }[];
  createdAt: string;
};

export type Thread = {
  id: string;
  shopId: string;
  buyerId: string;
  buyerName: string;
  lastAt: string;
  lastText: string;
  /** Unread counts per side. */
  unreadBuyer: number;
  unreadShop: number;
};

export type Message = {
  id: string;
  threadId: string;
  from: "buyer" | "shop" | "system";
  text?: string;
  image?: string;
  orderId?: string;
  at: string;
};

export type CartLine = { productId: string; shopId: string; qty: number };

export const ORDER_FLOW: OrderStatus[] = ["awaiting_payment", "slip_submitted", "paid", "shipped", "completed"];

export const CARRIERS = ["thailand-post", "kerry", "flash", "jt", "ninjavan", "other"] as const;
