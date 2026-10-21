"use client";

import { MessageCircle, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { TEST_MODE, useMarketQuery } from "@/features/market/store";
import { LoadError } from "@/features/market/ui/buyer";
import type { Shop, Thread } from "@/features/market/types";
import { Link } from "@/i18n/navigation";
import { initials, relativeTime } from "./format";

export type Side = "buyer" | "shop";
export type InboxRow = { thread: Thread; side: Side; name: string; logo?: string; tint?: string };

/** Threads where the user is the buyer, plus their shop's threads if they own one. Reloads on store changes. */
export function useInbox(userId: string) {
  return useMarketQuery(
    async (s) => {
      const [bought, shop] = await Promise.all([s.buyerThreads(userId), s.myShop(userId)]);
      const shops = new Map<string, Shop | null>();
      await Promise.all([...new Set(bought.map((t) => t.shopId))].map(async (id) => shops.set(id, await s.getShopById(id))));
      const buying: InboxRow[] = bought.map((t) => {
        const sh = shops.get(t.shopId);
        return { thread: t, side: "buyer", name: sh?.name ?? "…", logo: sh?.logo, tint: sh?.tint };
      });
      const selling: InboxRow[] = shop ? (await s.shopThreads(shop.id)).map((t) => ({ thread: t, side: "shop", name: t.buyerName || "…" })) : [];
      return { shop, buying, selling };
    },
    [userId],
  );
}

export function Avatar({ name, logo, tint, size = "size-11" }: { name: string; logo?: string; tint?: string; size?: string }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- data URLs in test mode
    <img src={logo} alt="" className={`${size} shrink-0 rounded-full border border-hairline object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} grid shrink-0 place-items-center rounded-full text-sm font-semibold ${tint ? "text-[#111]" : "bg-surface-2 text-ink"}`}
      style={tint ? { background: tint } : undefined}
    >
      {initials(name)}
    </span>
  );
}

export function TestBanner() {
  const t = useTranslations("chat");
  if (!TEST_MODE) return null;
  return <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs leading-relaxed text-muted">{t("testBanner")}</p>;
}

export function Inbox({ userId, activeId }: { userId: string; activeId?: string }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { data, error, retry } = useInbox(userId);
  const [pickedTab, setTab] = useState<Side | null>(null);

  if (!data && error)
    return (
      <div className="flex flex-1 flex-col p-4">
        <LoadError onRetry={retry} />
      </div>
    );
  if (!data) return <div className="flex-1" aria-busy="true" />;

  // Open on the side the current conversation belongs to.
  const activeSide: Side | undefined =
    data.selling.some((r) => r.thread.id === activeId) && !data.buying.some((r) => r.thread.id === activeId) ? "shop" : undefined;
  const tab: Side = data.shop ? (pickedTab ?? activeSide ?? "buyer") : "buyer";
  const rows = tab === "shop" ? data.selling : data.buying;
  const unread = (rs: InboxRow[]) => rs.reduce((n, r) => n + (r.side === "buyer" ? r.thread.unreadBuyer : r.thread.unreadShop), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <TestBanner />
        {data.shop && (
          <div role="group" aria-label={t("tabs.label")} className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
            {(["buyer", "shop"] as const).map((s) => {
              const n = unread(s === "shop" ? data.selling : data.buying);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={tab === s}
                  onClick={() => setTab(s)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-muted transition-colors aria-pressed:bg-bg aria-pressed:text-ink aria-pressed:shadow-soft"
                >
                  {s === "shop" && <Store className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                  {s === "shop" ? t("tabs.shop") : t("tabs.buying")}
                  {n > 0 && (
                    <span className="min-w-5 rounded-full bg-[#D7FF3A] px-1.5 text-xs leading-5 font-semibold text-[#111] tabular-nums">
                      <span className="sr-only">{t("unread", { count: n })}</span>
                      <span aria-hidden="true">{n}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-4 py-6">
          <span className="grid size-12 place-items-center rounded-full bg-surface" aria-hidden="true">
            <MessageCircle className="size-5" strokeWidth={1.75} />
          </span>
          <p className="font-semibold">{t("empty.title")}</p>
          <p className="text-sm leading-relaxed text-muted">{tab === "shop" ? t("empty.shop") : t("empty.body")}</p>
          {tab === "buyer" && (
            <Link href="/shops" className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">
              {t("empty.browse")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {rows.map((r) => {
            const n = r.side === "buyer" ? r.thread.unreadBuyer : r.thread.unreadShop;
            const active = r.thread.id === activeId;
            return (
              <li key={`${r.side}:${r.thread.id}`}>
                <Link
                  // Which side this row is: an account that owns the shop and also bought from it
                  // would otherwise reply to itself as the buyer.
                  href={`/messages/${r.thread.id}${r.side === "shop" ? "?as=shop" : ""}`}
                  aria-current={active ? "page" : undefined}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface aria-[current=page]:bg-surface"
                >
                  <Avatar name={r.name} logo={r.logo} tint={r.tint} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${n > 0 ? "font-semibold" : "font-medium"}`}>{r.name}</span>
                      <time dateTime={r.thread.lastAt} className="shrink-0 text-xs text-muted">
                        {relativeTime(r.thread.lastAt, locale)}
                      </time>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${n > 0 ? "text-ink" : "text-muted"}`}>{r.thread.lastText || " "}</span>
                      {n > 0 && (
                        <span className="min-w-5 shrink-0 rounded-full bg-[#D7FF3A] px-1.5 text-center text-xs leading-5 font-semibold text-[#111] tabular-nums">
                          <span className="sr-only">{t("unread", { count: n })}</span>
                          <span aria-hidden="true">{n}</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
