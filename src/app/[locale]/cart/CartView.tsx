"use client";

import { Info, Minus, Plus, ShoppingCart, Store, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cart, shippingFor, useCart, useMarket } from "@/features/market/store";
import { ExampleBadge, primaryBtn, useHydrated, useProductName, useThb } from "@/features/market/ui/buyer";
import type { Product, Shop } from "@/features/market/types";
import { Link } from "@/i18n/navigation";

const stepBtn = "grid size-9 place-items-center rounded-full transition-colors hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent";

/** Cart on this device, one group per shop: each shop is checked out and paid separately. */
export function CartView() {
  const t = useTranslations("market.cart");
  const tm = useTranslations("market");
  const ts = useTranslations("shop");
  const thb = useThb();
  const nameOf = useProductName();
  const hydrated = useHydrated();
  const lines = useCart();
  const key = lines.map((l) => l.productId).join(",");
  const data = useMarket(
    async (s) => {
      const ids = key ? key.split(",") : [];
      const products = await s.getProducts(ids);
      const shopIds = [...new Set(products.map((p) => p.shopId))];
      const shops = (await Promise.all(shopIds.map((id) => s.getShopById(id)))).filter((x): x is Shop => !!x);
      return { key, products: new Map(products.map((p) => [p.id, p])), shops: new Map(shops.map((x) => [x.id, x])) };
    },
    [key],
  );

  const shell = (children: ReactNode) => (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 pt-6 pb-24 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.02em]">{t("title")}</h1>
      </header>
      {children}
    </div>
  );

  if (!hydrated || (lines.length > 0 && !data)) {
    return shell(
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      </div>,
    );
  }

  if (lines.length === 0) {
    return shell(
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-16 text-center">
        <ShoppingCart className="size-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-lg font-semibold">{t("emptyTitle")}</p>
        <p className="max-w-[44ch] text-sm text-muted">{t("emptyBody")}</p>
        <Link href="/shops" className={`${primaryBtn} mt-3 h-11`}>
          {t("browse")}
        </Link>
      </div>,
    );
  }

  const fresh = data!.key === key;
  // Group by the shop recorded on the cart line, so lines whose product disappeared still show (and can be removed).
  const groups = new Map<string, typeof lines>();
  for (const l of lines) groups.set(l.shopId, [...(groups.get(l.shopId) ?? []), l]);

  return shell(
    <>
      <p className="flex gap-3 rounded-2xl bg-surface px-4 py-3 text-sm leading-relaxed">
        <Info className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
        <span>{t("separateNote")}</span>
      </p>

      {[...groups].map(([shopId, group]) => {
        const shop = data!.shops.get(shopId);
        const rows = group.map((l) => ({ line: l, product: data!.products.get(l.productId) as Product | undefined }));
        const unavailable = (p?: Product) => !p || !p.active || (p.stock !== null && p.stock <= 0);
        const blocked = !shop || shop.status !== "approved" || rows.some((r) => (fresh ? unavailable(r.product) : false) || (r.product?.stock != null && r.line.qty > r.product.stock));
        const subtotal = rows.reduce((n, r) => n + (r.product && !unavailable(r.product) ? r.product.priceThb * r.line.qty : 0), 0);
        const shipping = shop ? shippingFor(shop, subtotal) : 0;
        const headingId = `shop-${shopId.replace(/[^a-z0-9-]/gi, "")}`;
        return (
          <section key={shopId} aria-labelledby={headingId} className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-bg">
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 sm:px-5">
              <Store className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
              <h2 id={headingId} className="font-semibold">
                {shop ? (
                  <Link href={`/shops/${shop.slug}`} className="underline-offset-4 hover:underline">
                    {shop.name}
                  </Link>
                ) : (
                  t("shopGone")
                )}
              </h2>
              {shop?.example && <ExampleBadge />}
            </div>

            <ul className="flex flex-col divide-y divide-hairline">
              {rows.map(({ line, product: p }) => {
                const gone = fresh && unavailable(p);
                const max = Math.min(99, p?.stock ?? 99);
                const name = p ? nameOf(p.id, p.name) : t("itemGone");
                return (
                  <li key={line.productId} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                    <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-surface p-2 sm:size-24">
                      {p && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className={`max-h-full max-w-full object-contain ${gone ? "opacity-40 grayscale" : ""}`} />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm font-medium break-words">{name}</p>
                        {p && !gone && <span className="shrink-0 font-semibold tabular-nums">{thb(p.priceThb * line.qty)}</span>}
                      </div>
                      {p && (
                        <p className="text-xs text-muted tabular-nums">
                          {ts("size", { w: p.widthMm, h: p.heightMm })} · {ts(`finish.${p.finish}`)} · {thb(p.priceThb)}
                        </p>
                      )}
                      {gone && <p className="text-xs font-medium text-[#B3261E] dark:text-[#FF8A80]">{t("unavailable")}</p>}
                      {!gone && p?.stock != null && line.qty > p.stock && (
                        <p className="text-xs font-medium text-[#B3261E] dark:text-[#FF8A80]">{t("onlyLeft", { n: p.stock })}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        {gone ? (
                          <span />
                        ) : (
                          <div className="inline-flex items-center rounded-full border border-hairline" role="group" aria-label={t("qtyLabel", { name })}>
                            <button
                              type="button"
                              className={stepBtn}
                              onClick={() => cart.setQty(line.productId, line.qty - 1)}
                              disabled={line.qty <= 1}
                              aria-label={t("decrease")}
                            >
                              <Minus className="size-3.5" strokeWidth={2} aria-hidden="true" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              className={stepBtn}
                              onClick={() => cart.setQty(line.productId, line.qty + 1)}
                              disabled={line.qty >= max}
                              aria-label={t("increase")}
                            >
                              <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => cart.setQty(line.productId, 0)}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface hover:text-ink"
                          aria-label={t("removeAria", { name })}
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t("remove")}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-4 border-t border-hairline bg-surface/60 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
              <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm sm:min-w-56">
                <dt className="text-muted">{tm("subtotal")}</dt>
                <dd className="text-right tabular-nums">{thb(subtotal)}</dd>
                <dt className="text-muted">{tm("shipping")}</dt>
                <dd className="text-right tabular-nums">{shipping === 0 ? tm("free") : thb(shipping)}</dd>
                <dt className="font-semibold">{tm("total")}</dt>
                <dd className="text-right text-lg font-semibold tabular-nums">{thb(subtotal + shipping)}</dd>
                {shop?.freeShippingFromThb && shipping > 0 && (
                  <dd className="col-span-2 pt-1 text-xs text-muted">{t("freeFrom", { amount: thb(shop.freeShippingFromThb - subtotal) })}</dd>
                )}
              </dl>
              <div className="flex flex-col gap-2 sm:items-end">
                {blocked ? (
                  <>
                    <button type="button" disabled className={`${primaryBtn} h-12 w-full sm:w-auto sm:px-7`}>
                      {t("checkout")}
                    </button>
                    <p className="text-xs text-muted">{shop && shop.status === "approved" ? t("fixFirst") : t("shopClosed")}</p>
                  </>
                ) : (
                  <Link href={`/checkout/${encodeURIComponent(shopId)}`} className={`${primaryBtn} h-12 w-full sm:w-auto sm:px-7`}>
                    {t("checkout")}
                  </Link>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </>,
  );
}
