"use client";

import { CheckCircle2, Clock, ExternalLink, FlaskConical, MessageCircle, Package, Store, Truck, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent } from "react";
import { getStore, TEST_MODE, useMarketQuery } from "@/features/market/store";
import { LoadError } from "@/features/market/ui/buyer";
import type { Order, Shop } from "@/features/market/types";
import { AuthGate } from "@/components/AuthGate";
import { Link } from "@/i18n/navigation";
import type { Session } from "@/lib/session";
import { OrdersTab, type OrderFilter } from "./OrdersTab";
import { ProductsTab } from "./ProductsTab";
import { SettingsTab } from "./SettingsTab";
import { ariaFor, cardClass, Field, fieldClass, primaryBtn, TypeChips, useMoney } from "./ui";

export function SellerGate() {
  return <AuthGate>{(session) => <SellerDashboard session={session} />}</AuthGate>;
}

/** `undefined` while loading, `null` when this account has no shop yet. */
function SellerDashboard({ session }: { session: Session }) {
  const t = useTranslations("seller");
  const userId = session.user.id;
  const { data: shop, error, retry } = useMarketQuery((s) => s.myShop(userId), [userId]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 pt-6 pb-20 sm:px-8">
      {TEST_MODE && (
        <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {t("testMode")}
        </p>
      )}
      {shop === undefined && error ? (
        <LoadError onRetry={retry} />
      ) : shop === undefined ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface" aria-busy="true" aria-label={t("loading")} />
      ) : shop === null ? (
        <CreateShop session={session} />
      ) : (
        <Dashboard shop={shop} />
      )}
    </div>
  );
}

function CreateShop({ session }: { session: Session }) {
  const t = useTranslations("seller");
  const ta = useTranslations("auth");
  const fromOnboarding = session.profile?.shop;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"name" | "types" | "save" | "suspended" | null>(null);
  const [types, setTypes] = useState<string[]>(["die-cut"]);

  const create = async (name: string, about: string, productTypes: string[]) => {
    setBusy(true);
    setError(null);
    try {
      await (await getStore()).saveMyShop(session.user.id, { name, about, productTypes });
    } catch (e) {
      // A suspended account can't open a shop (0005); anything else is a plain save failure.
      setError(e instanceof Error && e.message === "account-suspended" ? "suspended" : "save");
      setBusy(false);
    }
  };

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="create-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface" aria-hidden="true">
          <Store className="size-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 id="create-title" className="text-2xl font-semibold tracking-tight">
            {t("create.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("create.body")}</p>
        </div>
      </div>

      {fromOnboarding ? (
        <div className="flex flex-col gap-4 rounded-xl bg-surface p-4">
          <div>
            <p className="font-medium">{fromOnboarding.name}</p>
            {fromOnboarding.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{fromOnboarding.description}</p>}
            <p className="mt-2 text-xs text-muted">{fromOnboarding.productTypes.map((p) => ta(`products.${p}`)).join(" · ")}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create(fromOnboarding.name, fromOnboarding.description, fromOnboarding.productTypes)}
            className={`${primaryBtn} self-start`}
          >
            {t("create.fromApplication")}
          </button>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const name = String(f.get("name") ?? "").trim();
            if (name.length < 2 || name.length > 80) return setError("name");
            if (!types.length) return setError("types");
            void create(
              name,
              String(f.get("about") ?? "")
                .trim()
                .slice(0, 1000),
              types,
            );
          }}
        >
          <Field id="create-name" label={t("settings.name")} error={error === "name" ? t("errors.shopName") : undefined}>
            <input
              id="create-name"
              name="name"
              maxLength={80}
              autoComplete="organization"
              className={fieldClass}
              {...ariaFor("create-name", error === "name" ? "x" : undefined)}
            />
          </Field>
          <Field id="create-about" label={t("settings.about")} hint={t("settings.aboutHint")}>
            <textarea id="create-about" name="about" maxLength={1000} rows={3} className={`${fieldClass} h-auto py-3`} aria-describedby="create-about-hint" />
          </Field>
          <TypeChips value={types} onChange={setTypes} error={error === "types" ? t("errors.productTypes") : undefined} />
          <button type="submit" disabled={busy} className={`${primaryBtn} self-start`}>
            {t("create.submit")}
          </button>
        </form>
      )}
      {(error === "save" || error === "suspended") && (
        <p role="alert" className="text-sm text-[#C62F35]">
          {t(error === "suspended" ? "errors.suspended" : "errors.save")}
        </p>
      )}
      <p className="text-xs text-muted">{t("create.review")}</p>
    </section>
  );
}

function StatusBanner({ shop }: { shop: Shop }) {
  const t = useTranslations("seller.banner");
  const te = useTranslations("seller.errors");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (shop.status === "approved")
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#DDF5E6] px-4 py-3 text-sm text-[#15603A]">
        <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="mr-auto">{t("approved")}</span>
        <Link href={`/shops/${shop.slug}`} className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4">
          {t("viewShop")}
          <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    );
  if (shop.status === "rejected")
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-[#FDE2E2] px-4 py-3 text-sm text-[#8A1F24]">
        <XCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>
          {t("rejected")}
          {shop.statusReason && (
            <span className="mt-1 block">
              <strong className="font-semibold">{t("reason")}</strong> {shop.statusReason}
            </span>
          )}
        </span>
      </div>
    );
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#FFF1C9] px-4 py-3 text-sm text-[#6B4E00] sm:flex-row sm:items-center">
      <div className="flex items-start gap-3 sm:mr-auto">
        <Clock className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>
          <strong className="font-semibold">{t("pendingTitle")}</strong> {t("pendingBody")}
          {shop.statusReason && (
            <span className="mt-1 block">
              <strong className="font-semibold">{t("reason")}</strong> {shop.statusReason}
            </span>
          )}
        </span>
      </div>
      {TEST_MODE && (
        <div className="flex flex-col gap-1.5 self-start sm:items-end sm:self-auto">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try {
                await (await getStore()).approveForTesting?.(shop.id);
              } catch {
                setFailed(true);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#111] px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            <FlaskConical className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t("approveForTesting")}
          </button>
          {failed && (
            <p role="alert" className="text-xs text-[#8A1F24]">
              {te("save")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** YYYY-MM in Thailand (UTC+7, no daylight saving), so "this month" turns over at Thai midnight. */
const bangkokMonth = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 7);

const TABS = ["overview", "products", "orders", "settings"] as const;
type Tab = (typeof TABS)[number];

function Dashboard({ shop }: { shop: Shop }) {
  const t = useTranslations("seller");
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const { data: orders, error: ordersError, retry: retryOrders } = useMarketQuery((s) => s.shopOrders(shop.id), [shop.id]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + TABS.length) % TABS.length;
    setTab(TABS[n]);
    tabRefs.current[n]?.focus();
  };
  const goOrders = (f: OrderFilter) => {
    setFilter(f);
    setTab("orders");
  };

  return (
    <>
      <header className="flex items-center gap-4">
        <span
          className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-xl font-semibold text-[#111]"
          style={{ background: shop.tint }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URLs in test mode */}
          {shop.logo ? <img src={shop.logo} alt="" className="size-full object-cover" /> : shop.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("title")}</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{shop.name}</h1>
        </div>
      </header>

      <StatusBanner shop={shop} />

      <div role="tablist" aria-label={t("title")} className="-mx-5 flex gap-1 overflow-x-auto border-b border-hairline px-5 sm:mx-0 sm:px-0">
        {TABS.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            onKeyDown={(e) => onKey(e, i)}
            className="relative shrink-0 px-3 py-3 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:text-ink aria-selected:text-ink aria-selected:after:absolute aria-selected:after:inset-x-3 aria-selected:after:-bottom-px aria-selected:after:h-0.5 aria-selected:after:rounded-full aria-selected:after:bg-ink"
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      {/* Every panel stays mounted (hidden when not selected) so a half-edited form survives a tab switch. */}
      {TABS.map((k) => (
        <div key={k} role="tabpanel" id={`panel-${k}`} aria-labelledby={`tab-${k}`} hidden={tab !== k}>
          {k !== "products" && k !== "settings" && !orders && ordersError && <LoadError onRetry={retryOrders} className="mt-2 mb-4" />}
          {k === "overview" && <Overview shop={shop} orders={orders} goOrders={goOrders} goProducts={() => setTab("products")} />}
          {k === "products" && <ProductsTab shop={shop} />}
          {k === "orders" && <OrdersTab orders={orders} filter={filter} setFilter={setFilter} />}
          {k === "settings" && <SettingsTab shop={shop} />}
        </div>
      ))}
    </>
  );
}

function Overview({ shop, orders, goOrders, goProducts }: { shop: Shop; orders?: Order[]; goOrders: (f: OrderFilter) => void; goProducts: () => void }) {
  const t = useTranslations("seller.overview");
  const money = useMoney();
  const { data: products, error: productsError, retry: retryProducts } = useMarketQuery((s) => s.listProducts(shop.id, { includeInactive: true }), [shop.id]);
  const { data: threads, error: threadsError, retry: retryThreads } = useMarketQuery((s) => s.shopThreads(shop.id), [shop.id]);
  const list = orders ?? [];
  const toCheck = list.filter((o) => o.status === "slip_submitted").length;
  const toShip = list.filter((o) => o.status === "paid").length;
  const month = bangkokMonth(new Date().toISOString());
  // Money the shop confirmed receiving this month, Thai time: dated by when the slip was accepted
  // (the "paid" event), not by when the order was placed. Includes shipping, as the buyer paid it.
  const revenue = list
    .filter((o) => {
      if (!["paid", "shipped", "completed"].includes(o.status)) return false;
      const paidAt = o.history.find((h) => h.status === "paid")?.at;
      return bangkokMonth(paidAt ?? o.createdAt) === month;
    })
    .reduce((s, o) => s + o.totalThb, 0);
  const unread = (threads ?? []).reduce((s, x) => s + x.unreadShop, 0);
  const activeCount = (products ?? []).filter((p) => p.active).length;

  const needs = [
    { key: "toCheck", n: toCheck, icon: Clock, onClick: () => goOrders("check") },
    { key: "toShip", n: toShip, icon: Truck, onClick: () => goOrders("ship") },
  ] as const;

  return (
    <div className="flex flex-col gap-6 pt-2">
      {((!products && productsError) || (!threads && threadsError)) && (
        <LoadError
          onRetry={() => {
            retryProducts();
            retryThreads();
          }}
        />
      )}
      <section aria-labelledby="needs-title" className="flex flex-col gap-3">
        <h2 id="needs-title" className="text-sm font-medium text-muted">
          {t("needsAction")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {needs.map(({ key, n, icon: Icon, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-shadow hover:shadow-soft ${n ? "border-ink bg-bg" : "border-hairline bg-bg"}`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full ${n ? "bg-[#D7FF3A] text-[#111]" : "bg-surface text-muted"}`}
                aria-hidden="true"
              >
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-3xl font-semibold tabular-nums">{orders ? n : "–"}</span>
                <span className="text-sm text-muted">{t(key)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label={t("summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className={`${cardClass} col-span-2 lg:col-span-1`}>
          <p className="text-sm text-muted">{t("revenue")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(revenue)}</p>
          <p className="mt-1 text-xs text-muted">{t("revenueHint")}</p>
        </div>
        <button type="button" onClick={goProducts} className={`${cardClass} text-left transition-shadow hover:shadow-soft`}>
          <Package className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{products ? products.length : "–"}</p>
          {/* Nothing is on sale while the shop itself is hidden, however many listings are active. */}
          <p className="text-sm text-muted">{shop.status === "approved" ? t("products", { active: activeCount }) : t("productsHidden")}</p>
        </button>
        <Link href="/messages" className={`${cardClass} transition-shadow hover:shadow-soft`}>
          <MessageCircle className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{unread}</p>
          <p className="text-sm text-muted">{t("messages")}</p>
        </Link>
      </section>

      {!shop.promptpay && <p className="rounded-2xl border border-dashed border-hairline p-4 text-sm text-muted">{t("noPromptPay")}</p>}
    </div>
  );
}
