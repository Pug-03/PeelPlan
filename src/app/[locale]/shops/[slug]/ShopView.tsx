"use client";

import { ArrowLeft, BadgeCheck, Clock, ExternalLink, MapPin, MessageCircle, Package, Plus, ShoppingCart, Star, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { DemoShop, ShopReview } from "@/config/demoShops";
import { cart, useMarket } from "@/features/market/store";
import { ExampleBadge, LINK_META, openChat, primaryBtn, useThb, useToast } from "@/features/market/ui/buyer";
import { LINK_KINDS, type Product, type Shop } from "@/features/market/types";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSession } from "@/lib/session";
import { VISIBLE_LIBRARY, stickerThumb } from "@/stickers/library";

const byId = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));
type Tab = "products" | "reviews" | "about";

/** What the page shows about a shop, from either an example shop or a real (database / test-mode) shop. */
export type ShopProfile = {
  slug: string;
  name: string;
  initials: string;
  tint: string;
  city: string;
  /** YYYY-MM, UTC. */
  joined: string;
  verified: boolean;
  about: string;
  productTypes: string[];
  logo?: string;
  cover?: string;
  example: boolean;
  /** Example shops only: fictional stats and reviews. */
  stats?: DemoShop["stats"];
  reviews?: ShopReview[];
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function profileFromDemo(d: DemoShop, locale: "th" | "en", example = true): ShopProfile {
  return {
    slug: d.slug,
    name: d.name,
    initials: d.initials,
    tint: d.tint,
    city: d.city[locale],
    joined: d.joined,
    verified: d.verified,
    about: d.about[locale],
    productTypes: d.productTypes,
    example,
    stats: example ? d.stats : undefined,
    reviews: example ? d.reviews : undefined,
  };
}

export function profileFromShop(s: Shop): ShopProfile {
  return {
    slug: s.slug,
    name: s.name,
    initials: initialsOf(s.name) || "?",
    tint: s.tint,
    city: s.city,
    joined: s.createdAt.slice(0, 7),
    verified: s.status === "approved",
    about: s.about,
    productTypes: s.productTypes,
    logo: s.logo,
    cover: s.cover,
    example: !!s.example,
  };
}

/** The example shop's listings as the store builds them, so the static page has products before the store loads. */
export function demoProducts(d: DemoShop): Product[] {
  return d.products.flatMap((p) => {
    const def = byId.get(p.stickerId);
    if (!def) return [];
    return [
      {
        id: `example:${d.slug}:${p.stickerId}`,
        shopId: `example:${d.slug}`,
        name: def.name.th,
        image: stickerThumb(def),
        stickerId: p.stickerId,
        widthMm: def.widthMm,
        heightMm: Math.round(((def.widthMm * def.viewBox[1]) / def.viewBox[0]) * 10) / 10,
        priceThb: p.priceThb,
        stock: null,
        finish: p.finish,
        active: true,
        createdAt: `${d.joined}-01T00:00:00.000Z`,
      },
    ];
  });
}

/**
 * Public shop profile: cover, identity, stats, then Products / Reviews / About.
 * `preview` = a brand-new seller's own view (no buying or chat). `market` = the store's shop record, when already loaded.
 */
export function ShopView({
  demo,
  profile,
  preview = false,
  market: marketProp,
  pending = false,
}: {
  /** An example shop (or a seller's preview), rendered statically. */
  demo?: DemoShop;
  /** A real shop, already loaded on the client. */
  profile?: ShopProfile;
  preview?: boolean;
  market?: Shop;
  pending?: boolean;
}) {
  const t = useTranslations("shop");
  const tm = useTranslations("market");
  const tp = useTranslations("auth.products");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const thb = useThb();
  const shop = profile ?? profileFromDemo(demo!, locale, !preview);
  const initialProducts = demo && !preview ? demoProducts(demo) : [];
  const [tab, setTab] = useState<Tab>("products");
  const [following, setFollowing] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [toast, showToast] = useToast();

  const loaded = useMarket((s) => (preview || marketProp ? Promise.resolve(null) : s.getShop(shop.slug)), [shop.slug, preview, !!marketProp]);
  const market = marketProp ?? loaded ?? undefined;
  const storeProducts = useMarket((s) => (market ? s.listProducts(market.id) : Promise.resolve(undefined)), [market?.id]);
  const products = preview ? [] : (storeProducts ?? initialProducts);

  const fmt = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");
  // `joined` is a UTC month; format it in UTC so server and browser agree in every time zone.
  const joined = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${shop.joined}-01`),
  );
  const coverImages = products.slice(0, 9).map((p) => p.image);
  const links = market ? LINK_KINDS.filter((k) => market.links[k]?.trim()) : [];
  // Example listings are built from the sticker library, which has names in both languages.
  const nameOf = (p: Product) => (shop.example && p.stickerId ? (byId.get(p.stickerId)?.name[locale] ?? p.name) : p.name);

  const chat = async () => {
    if (session.status !== "signed-in" || !market) return;
    setChatBusy(true);
    try {
      const u = session.session;
      router.push(await openChat(market.id, u.user.id, u.profile?.displayName || u.user.name));
    } finally {
      setChatBusy(false);
    }
  };

  const add = (p: Product) => {
    cart.add(p.id, p.shopId);
    showToast(
      <>
        <span>{tm("shopPage.added", { name: nameOf(p) })}</span>
        <Link href="/cart" className="rounded-full bg-bg/15 px-3 py-1 text-xs font-semibold underline-offset-2 hover:underline">
          {tm("shopPage.viewCart")}
        </Link>
      </>,
    );
  };

  const shippingText = market
    ? market.freeShippingFromThb
      ? tm("shopPage.shippingFree", { fee: thb(market.shippingThb), from: thb(market.freeShippingFromThb) })
      : tm("shopPage.shippingFlat", { fee: thb(market.shippingThb) })
    : t("shippingValue");

  const stats = shop.stats;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 pt-6 pb-20 sm:px-8">
      {!preview && (
        <Link href="/shops" className="-my-2 inline-flex items-center gap-1.5 self-start rounded-full py-1 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {t("allShops")}
        </Link>
      )}
      {(preview || pending) && (
        <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-accent-soft px-5 py-4">
          <p className="font-semibold">{t("previewTitle")}</p>
          <p className="text-sm text-muted">{t("previewBody")}</p>
        </div>
      )}

      {/* Cover: the shop's own photo, or its stickers scattered like a sheet */}
      <div className="relative">
        <div
          className="relative h-44 overflow-hidden rounded-[1.75rem] sm:h-56"
          style={{ background: `linear-gradient(135deg, ${shop.tint}, var(--surface))` }}
        >
          {shop.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.cover} alt="" className="size-full object-cover" />
          ) : (
            coverImages.map((src, i) => {
              const x = 8 + ((i * 37) % 86);
              const y = 12 + ((i * 53) % 70);
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="absolute w-16 drop-shadow-md sm:w-20"
                  style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${((i * 23) % 30) - 15}deg)` }}
                />
              );
            })
          )}
        </div>
        <span
          className="absolute -bottom-10 left-6 grid size-24 place-items-center overflow-hidden rounded-full border-4 border-bg text-2xl font-bold text-[#111] shadow-soft sm:left-10"
          style={{ background: shop.tint }}
          aria-hidden="true"
        >
          {shop.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logo} alt="" className="size-full object-cover" />
          ) : (
            shop.initials
          )}
        </span>
      </div>

      {/* Identity */}
      <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
            {shop.example && !preview && <ExampleBadge />}
            {shop.verified && !preview && !pending ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium">
                <BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {t("verified")}
              </span>
            ) : (
              (preview || pending) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                  <Clock className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  {t("pending")}
                </span>
              )
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {shop.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {shop.city}
              </span>
            )}
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
            {session.status === "signed-out" ? (
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium transition-colors hover:border-ink"
              >
                <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t("chat")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={chat}
                disabled={session.status === "loading" || !market || chatBusy}
                aria-busy={chatBusy}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium transition-colors hover:border-ink disabled:opacity-60"
              >
                <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t("chat")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Other places to buy from this shop */}
      {!preview && links.length > 0 && market && (
        <section aria-labelledby="buy-elsewhere" className="flex flex-col gap-2.5">
          <h2 id="buy-elsewhere" className="text-sm font-semibold">
            {tm("shopPage.elsewhere")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {links.map((k) => {
              const { label, icon: Icon } = LINK_META[k];
              return (
                <li key={k}>
                  <a
                    href={market.links[k]}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-bg px-4 text-sm font-medium transition-colors hover:border-ink"
                  >
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {label}
                    <ExternalLink className="size-3.5 text-muted" strokeWidth={1.75} aria-hidden="true" />
                    <span className="sr-only">{tm("shopPage.newTab")}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Stats (example shops only: real shops get these from orders later) */}
      {stats && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-4">
          {[
            { icon: Package, label: t("sold"), value: fmt.format(stats.sold) },
            {
              icon: Star,
              label: t("rating"),
              value: stats.reviews ? `${stats.rating.toFixed(1)}` : "–",
              sub: stats.reviews ? t("reviewsCount", { count: fmt.format(stats.reviews) }) : undefined,
            },
            { icon: Users, label: t("followers"), value: fmt.format(stats.followers + (following ? 1 : 0)) },
            { icon: Clock, label: t("response"), value: t("responseValue", { hours: stats.responseHours }) },
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
      )}

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
              {k === "products" && <span className="ml-1.5 tabular-nums">{products.length}</span>}
            </button>
          ))}
        </div>

        {tab === "products" && (
          <div role="tabpanel" id="panel-products" aria-labelledby="tab-products">
            {products.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-14 text-center">
                <Package className="size-7 text-muted" strokeWidth={1.5} aria-hidden="true" />
                <p className="font-semibold">{t("emptyTitle")}</p>
                {preview ? (
                  <>
                    <p className="max-w-[46ch] text-sm text-muted">{t("emptyBody")}</p>
                    <button
                      type="button"
                      disabled
                      className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink opacity-60"
                    >
                      <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                      {t("addProduct")}
                    </button>
                  </>
                ) : (
                  <p className="max-w-[46ch] text-sm text-muted">{tm("shopPage.noProducts")}</p>
                )}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {products.map((p) => {
                  const soldOut = p.stock !== null && p.stock <= 0;
                  const name = nameOf(p);
                  return (
                    <li key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-bg transition-shadow hover:shadow-soft">
                      <div className="relative grid aspect-square place-items-center bg-surface p-5 sm:p-6">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image}
                          alt=""
                          className={`max-h-full max-w-full object-contain drop-shadow-md transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105 ${soldOut ? "opacity-40 grayscale" : ""}`}
                        />
                        {soldOut && (
                          <span className="absolute top-2.5 left-2.5 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-bg">{tm("shopPage.soldOut")}</span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
                        <p className="truncate text-sm font-medium" title={name}>
                          {name}
                        </p>
                        <p className="text-xs text-muted tabular-nums">
                          {t("size", { w: p.widthMm, h: p.heightMm })} · {t(`finish.${p.finish}`)}
                        </p>
                        {!soldOut && p.stock !== null && p.stock <= 5 && <p className="text-xs font-medium text-[#B25E00] dark:text-[#FFB25E]">{tm("shopPage.left", { n: p.stock })}</p>}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <span className="font-semibold tabular-nums">{thb(p.priceThb)}</span>
                          {p.stickerId && (
                            <Link
                              href={`/editor?add=${encodeURIComponent(p.stickerId)}`}
                              className="rounded-full px-2 py-1 text-xs font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                            >
                              {t("tryOn")}
                            </Link>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => add(p)}
                          disabled={soldOut}
                          aria-label={soldOut ? `${name}: ${tm("shopPage.soldOut")}` : tm("shopPage.addAria", { name })}
                          className={`${primaryBtn} mt-2 h-10 w-full`}
                        >
                          <ShoppingCart className="size-4" strokeWidth={2} aria-hidden="true" />
                          {soldOut ? tm("shopPage.soldOut") : tm("shopPage.add")}
                        </button>
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
            {!shop.reviews?.length ? (
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
              <p className="max-w-[62ch] leading-relaxed whitespace-pre-line text-muted">{shop.about || "–"}</p>
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
                <p className="text-sm text-muted">{shippingText}</p>
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">{tm("shopPage.paymentTitle")}</h2>
                <p className="text-sm text-muted">{tm("shopPage.paymentBody")}</p>
              </div>
            </section>
          </div>
        )}
      </div>

      {shop.example && <p className="text-xs text-muted">{t("demoNote")}</p>}
      {toast}
    </div>
  );
}
