"use client";

/** Small pieces shared by the buyer pages (shop, cart, checkout, orders). */
import { Camera, CircleAlert, CircleCheck, FlaskConical, MessageCircle, Music2, RotateCw, ShoppingBag, ShoppingCart, ThumbsUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { VISIBLE_LIBRARY } from "@/stickers/library";
import { getStore } from "../store";
import type { LinkKind, OrderStatus } from "../types";

const libById = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));
/** Example listings come from the sticker library, which is named in both languages. */
export function useProductName() {
  const locale = useLocale() as "th" | "en";
  // Example ids are `example:<slug>:<stickerId>`, for listings and order items alike.
  return (id: string, name: string) => (id.startsWith("example:") ? (libById.get(id.split(":").slice(2).join(":"))?.name[locale] ?? name) : name);
}

export function useThb() {
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 2 });
  return (n: number) => `฿${fmt.format(n)}`;
}

export function useDateFmt() {
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  return (iso: string) => fmt.format(new Date(iso));
}

const noSubscribe = () => () => {};
/** False during SSR and hydration, true afterwards: for UI that depends on this device's storage. */
export function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/** Platform names stay in their own spelling in both languages. */
export const LINK_META: Record<LinkKind, { label: string; icon: typeof ShoppingBag }> = {
  tiktok: { label: "TikTok Shop", icon: Music2 },
  shopee: { label: "Shopee", icon: ShoppingBag },
  lazada: { label: "Lazada", icon: ShoppingCart },
  instagram: { label: "Instagram", icon: Camera },
  facebook: { label: "Facebook", icon: ThumbsUp },
  line: { label: "LINE", icon: MessageCircle },
};

const PILL: Record<OrderStatus, string> = {
  awaiting_payment: "bg-[#FFF4D6] text-[#7A5300] dark:bg-[#3A2F12] dark:text-[#FFD978]",
  slip_submitted: "bg-[#E3ECFF] text-[#1F3F99] dark:bg-[#1B2647] dark:text-[#A9C1FF]",
  paid: "bg-[#EFFFC2] text-[#3B4A00] dark:bg-[#2B3310] dark:text-[#D7FF3A]",
  shipped: "bg-ink text-bg",
  completed: "bg-[#DDF6E6] text-[#17663A] dark:bg-[#123322] dark:text-[#8EE0AE]",
  cancelled: "bg-surface text-muted",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const t = useTranslations("market.status");
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${PILL[status]}`}>{t(status)}</span>
  );
}

export function TestModeBanner({ children }: { children?: ReactNode }) {
  const t = useTranslations("market");
  return (
    <div className="flex gap-3 rounded-2xl border border-dashed border-hairline bg-surface px-4 py-3 text-sm">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">{t("testMode.title")}</p>
        <p className="leading-relaxed text-muted">{children ?? t("testMode.body")}</p>
      </div>
    </div>
  );
}

export function ExampleBadge() {
  const t = useTranslations("market");
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-ink/40 px-2.5 py-0.5 text-xs font-medium">{t("exampleBadge")}</span>
  );
}

/** A load from the store failed (offline, server error): say so instead of loading forever. */
export function LoadError({ onRetry, className = "" }: { onRetry: () => void; className?: string }) {
  const t = useTranslations("market.loadError");
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-12 text-center ${className}`}>
      <CircleAlert className="size-7 text-muted" strokeWidth={1.5} aria-hidden="true" />
      <p className="font-semibold">{t("title")}</p>
      <p className="max-w-[44ch] text-sm text-muted">{t("body")}</p>
      <button type="button" onClick={onRetry} className={`${secondaryBtn} mt-1 h-10`}>
        <RotateCw className="size-4" strokeWidth={1.75} aria-hidden="true" />
        {t("retry")}
      </button>
    </div>
  );
}

/** A short confirmation at the bottom of the screen, announced politely. */
export function useToast(): [ReactNode, (msg: ReactNode) => void] {
  const [msg, setMsg] = useState<ReactNode>(null);
  const [key, setKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: ReactNode) => {
    setMsg(m);
    setKey((k) => k + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
    >
      {msg && (
        <div key={key} className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2.5 pr-3 pl-4 text-sm text-bg shadow-soft">
          <CircleCheck className="size-4 shrink-0 text-[#D7FF3A]" strokeWidth={2} aria-hidden="true" />
          {msg}
        </div>
      )}
    </div>
  );
  return [node, show];
}

/** Opens (or reuses) the chat thread between a shop and a buyer, then goes to it. */
export async function openChat(shopId: string, buyerId: string, buyerName: string) {
  const s = await getStore();
  const thread = await s.openThread(shopId, buyerId, buyerName);
  return `/messages/${thread.id}`;
}

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#D7FF3A] px-5 text-sm font-semibold text-[#111] transition-[transform,filter] hover:brightness-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
export const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50";
export const inputCls =
  "h-11 w-full rounded-xl border border-hairline bg-bg px-3.5 text-base outline-none transition-colors focus:border-ink aria-invalid:border-[#D93025] sm:text-sm";
