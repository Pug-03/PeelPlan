"use client";

import { ArrowLeft, BadgeCheck, Clock, MapPin, MessageCircle, Package, Plus, Star, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { DemoShop } from "@/config/demoShops";
import { Link } from "@/i18n/navigation";
import { VISIBLE_LIBRARY, stickerThumb } from "@/stickers/library";

const byId = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));
type Tab = "products" | "reviews" | "about";

/** Public shop profile: cover, identity, stats, then Products / Reviews / About. `preview` = a brand-new seller's own view. */
export function ShopView({ shop, preview = false }: { shop: DemoShop; preview?: boolean }) {
  const t = useTranslations("shop");
  const tp = useTranslations("auth.products");
  const locale = useLocale() as "th" | "en";
  const [tab, setTab] = useState<Tab>("products");
  const [following, setFollowing] = useState(false);
  const fmt = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");
  // `joined` is a UTC month; format it in UTC so server and browser agree in every time zone.
  const joined = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${shop.joined}-01`),
  );
  const coverStickers = shop.products.slice(0, 9);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 pt-6 pb-20 sm:px-8">
      {!preview && (
        <Link href="/shops" className="-my-2 inline-flex items-center gap-1.5 self-start rounded-full py-1 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {t("allShops")}
        </Link>
      )}
      {preview && (
        <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-accent-soft px-5 py-4">
          <p className="font-semibold">{t("previewTitle")}</p>
          <p className="text-sm text-muted">{t("previewBody")}</p>
        </div>
      )}

      {/* Cover: the shop's own stickers scattered like a sheet */}
      <div className="relative">
        <div
          className="relative h-44 overflow-hidden rounded-[1.75rem] sm:h-56"
          style={{ background: `linear-gradient(135deg, ${shop.tint}, var(--surface))` }}
        >
          {coverStickers.map((p, i) => {
            const def = byId.get(p.stickerId);
            if (!def) return null;
            const x = 8 + ((i * 37) % 86);
            const y = 12 + ((i * 53) % 70);
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.stickerId}
                src={stickerThumb(def)}
                alt=""
                className="absolute w-16 drop-shadow-md sm:w-20"
                style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${((i * 23) % 30) - 15}deg)` }}
              />
            );
          })}
        </div>
        <span
          className="absolute -bottom-10 left-6 grid size-24 place-items-center rounded-full border-4 border-bg text-2xl font-bold text-[#111] shadow-soft sm:left-10"
          style={{ background: shop.tint }}
          aria-hidden="true"
        >
          {shop.initials}
        </span>
      </div>

      {/* Identity */}
      <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
            {shop.verified && !preview ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium">
                <BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {t("verified")}
              </span>
            ) : (
              preview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                  <Clock className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  {t("pending")}
                </span>
              )
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" strokeWidth={2} aria-hidden="true" />
              {shop.city[locale]}
            </span>
            <span>{t("joined", { date: joined })}</span>
          </p>
        </div>
        {!preview && (
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={following}
              onClick={() => setFollowing((f) => !f)}
              className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-transform active:scale-[0.97] aria-pressed:bg-surface aria-pressed:text-ink"
            >
              {following ? t("following") : t("follow")}
            </button>
            <button
              type="button"
              disabled
              title={t("chatSoon")}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium opacity-60"
            >
              <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t("chat")}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-4">
        {[
          { icon: Package, label: t("sold"), value: fmt.format(shop.stats.sold) },
          {
            icon: Star,
            label: t("rating"),
            value: shop.stats.reviews ? `${shop.stats.rating.toFixed(1)}` : "–",
            sub: shop.stats.reviews ? t("reviewsCount", { count: fmt.format(shop.stats.reviews) }) : undefined,
          },
          { icon: Users, label: t("followers"), value: fmt.format(shop.stats.followers + (following ? 1 : 0)) },
          { icon: Clock, label: t("response"), value: t("responseValue", { hours: shop.stats.responseHours }) },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="flex flex-col gap-1 bg-bg px-5 py-4">
            <dt className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-xl font-semibold tabular-nums">
              {value}
              {sub && <span className="ml-1.5 text-xs font-normal text-muted">{sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {/* Tabs */}
      <div className="flex flex-col gap-6">
        <div role="tablist" aria-label={shop.name} className="flex gap-1 border-b border-hairline">
          {(["products", "reviews", "about"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`panel-${k}`}
              onClick={() => setTab(k)}
              className="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted transition-colors aria-selected:border-ink aria-selected:text-ink"
            >
              {t(`tabs.${k}`)}
              {k === "products" && <span className="ml-1.5 tabular-nums">{shop.products.length}</span>}
            </button>
          ))}
        </div>

        {tab === "products" && (
          <div role="tabpanel" id="panel-products" aria-labelledby="tab-products">
            {shop.products.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-14 text-center">
                <Package className="size-7 text-muted" strokeWidth={1.5} aria-hidden="true" />
                <p className="font-semibold">{t("emptyTitle")}</p>
                <p className="max-w-[46ch] text-sm text-muted">{t("emptyBody")}</p>
                <button
                  type="button"
                  disabled
                  className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink opacity-60"
                >
                  <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                  {t("addProduct")}
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {shop.products.map((p) => {
                  const def = byId.get(p.stickerId);
                  if (!def) return null;
                  const w = def.widthMm;
                  const h = Math.round(((w * def.viewBox[1]) / def.viewBox[0]) * 10) / 10;
                  return (
                    <li
                      key={p.stickerId}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-bg transition-shadow hover:shadow-soft"
                    >
                      <div className="grid aspect-square place-items-center bg-surface p-6">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={stickerThumb(def)}
                          alt=""
                          className="max-h-full max-w-full object-contain drop-shadow-md transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-4">
                        <p className="truncate text-sm font-medium">{def.name[locale]}</p>
                        <p className="text-xs text-muted tabular-nums">
                          {t("size", { w, h })} · {t(`finish.${p.finish}`)}
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="font-semibold tabular-nums">฿{p.priceThb}</span>
                          <Link
                            href={`/editor?add=${encodeURIComponent(p.stickerId)}`}
                            className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-85"
                          >
                            {t("tryOn")}
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === "reviews" && (
          <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews">
            {shop.reviews.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-hairline px-6 py-10 text-center text-sm text-muted">{t("noReviews")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline rounded-2xl border border-hairline">
                {shop.reviews.map((r) => (
                  <li key={r.name + r.date} className="flex flex-col gap-1.5 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">{r.name}</span>
                      <span className="inline-flex" role="img" aria-label={`${r.rating}/5`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-current" : "opacity-25"}`} strokeWidth={1.5} aria-hidden="true" />
                        ))}
                      </span>
                      <span className="text-xs text-muted">
                        {r.laptop} · {r.date}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{r.text[locale]}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "about" && (
          <div role="tabpanel" id="panel-about" aria-labelledby="tab-about" className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">{t("aboutTitle")}</h2>
              <p className="max-w-[62ch] leading-relaxed text-muted">{shop.about[locale] || "–"}</p>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed">{t("policy")}</p>
            </section>
            <section className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">{t("makes")}</h2>
                <div className="flex flex-wrap gap-2">
                  {shop.productTypes.map((p) => (
                    <span key={p} className="rounded-full border border-hairline px-3 py-1 text-xs">
                      {tp(p as "die-cut")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">{t("shipping")}</h2>
                <p className="text-sm text-muted">{t("shippingValue")}</p>
              </div>
            </section>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">{t("demoNote")}</p>
    </div>
  );
}
