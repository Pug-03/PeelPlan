"use client";

import { ChevronRight, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Order, OrderStatus } from "@/features/market/types";
import { Link } from "@/i18n/navigation";
import { StatusPill, useDate, useMoney } from "./ui";

export const ORDER_FILTERS = ["all", "check", "ship", "shipped", "completed", "cancelled"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

const MATCH: Record<OrderFilter, OrderStatus | null> = {
  all: null,
  check: "slip_submitted",
  ship: "paid",
  shipped: "shipped",
  completed: "completed",
  cancelled: "cancelled",
};

export function OrdersTab({ orders, filter, setFilter }: { orders?: Order[]; filter: OrderFilter; setFilter: (f: OrderFilter) => void }) {
  const t = useTranslations("seller.orders");
  const money = useMoney();
  const date = useDate();
  const list = (orders ?? []).filter((o) => !MATCH[filter] || o.status === MATCH[filter]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = (f: OrderFilter) => (orders ?? []).filter((o) => !MATCH[f] || o.status === MATCH[f]).length;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div role="group" aria-label={t("filter")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {ORDER_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3.5 py-2 text-sm whitespace-nowrap transition-colors hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
          >
            {t(`filters.${f}`)}
            <span className="tabular-nums opacity-70">{count(f)}</span>
          </button>
        ))}
      </div>

      {orders === undefined ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" aria-busy="true" />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline px-5 py-12 text-center">
          <Inbox className="size-6 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <p className="font-medium">{filter === "all" ? t("emptyAll") : t("empty")}</p>
          {filter === "all" && <p className="max-w-sm text-sm text-muted">{t("emptyAllBody")}</p>}
        </div>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-bg">
          {list.map((o) => {
            const qty = o.items.reduce((s, it) => s + it.qty, 0);
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface sm:px-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-mono font-medium">{o.code}</span>
                      <span className="text-muted">{date(o.createdAt)}</span>
                    </p>
                    <p className="truncate text-sm text-muted">
                      {o.address.name} · {t("items", { count: qty })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{money(o.totalThb)}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
