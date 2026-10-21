"use client";

import { ChevronRight, Receipt, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthGate } from "@/components/AuthGate";
import { useMarketQuery } from "@/features/market/store";
import { LoadError, StatusPill, useDateFmt, useThb } from "@/features/market/ui/buyer";
import type { Shop } from "@/features/market/types";
import { Link } from "@/i18n/navigation";
import type { Session } from "@/lib/session";

export function OrdersGate() {
  return <AuthGate>{(session) => <OrdersView session={session} />}</AuthGate>;
}

/** The signed-in buyer's orders, newest first. */
function OrdersView({ session }: { session: Session }) {
  const t = useTranslations("market.orders");
  const thb = useThb();
  const date = useDateFmt();
  const userId = session.user.id;
  const { data, error, retry } = useMarketQuery(
    async (s) => {
      const orders = (await s.buyerOrders(userId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const shops = await Promise.all([...new Set(orders.map((o) => o.shopId))].map((id) => s.getShopById(id)));
      return { orders, shops: new Map(shops.filter((x): x is Shop => !!x).map((x) => [x.id, x])), myShop: await s.myShop(userId) };
    },
    [userId],
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 pt-6 pb-24 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.02em]">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </header>

      {data?.myShop && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm">
          <Store className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
          {t("sellerHint", { shop: data.myShop.name })}
          <Link href="/seller" className="font-medium underline underline-offset-4">
            {t("sellerLink")}
          </Link>
        </p>
      )}

      {!data && error ? (
        <LoadError onRetry={retry} />
      ) : !data ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : data.orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-16 text-center">
          <Receipt className="size-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-lg font-semibold">{t("emptyTitle")}</p>
          <p className="max-w-[44ch] text-sm text-muted">{t("emptyBody")}</p>
          <Link href="/shops" className="mt-3 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-bg">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.orders.map((o) => {
            const count = o.items.reduce((n, it) => n + it.qty, 0);
            return (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-hairline bg-bg p-4 transition-shadow hover:shadow-soft sm:p-5"
                >
                  <span className="hidden size-14 shrink-0 place-items-center rounded-xl bg-surface p-1.5 sm:grid">
                    {o.items[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.items[0].image} alt="" className="max-h-full max-w-full object-contain" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">{o.code}</span>
                      <StatusPill status={o.status} />
                    </span>
                    <span className="truncate text-sm text-muted">
                      {data.shops.get(o.shopId)?.name ?? "–"} · {t("items", { count })} · {date(o.createdAt)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{thb(o.totalThb)}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
