"use client";

import { ArrowLeft, Check, CircleAlert, ImageUp, MapPin, MessageCircle, PackageCheck, Truck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { fileToDataUrl, getStore, isReadOnlyExample, NEXT_STATUS, TEST_MODE, useMarketQuery, type MarketStore } from "@/features/market/store";
import { PromptPayQr } from "@/features/market/ui/PromptPayQr";
import {
  ExampleBadge,
  inputCls,
  LoadError,
  openChat,
  primaryBtn,
  secondaryBtn,
  StatusPill,
  TestModeBanner,
  useDateFmt,
  useProductName,
  useThb,
} from "@/features/market/ui/buyer";
import { CARRIERS, ORDER_FLOW, type Order, type OrderStatus, type Shop } from "@/features/market/types";
import { Link, useRouter } from "@/i18n/navigation";
import type { Session } from "@/lib/session";

type Role = "buyer" | "shop";

export function OrderGate({ id }: { id: string }) {
  return <AuthGate>{(session) => <OrderView session={session} id={id} />}</AuthGate>;
}

const card = "flex flex-col gap-4 rounded-2xl border border-hairline bg-bg p-4 sm:p-6";
const errorCls = "rounded-xl bg-[#FDECEA] p-3 text-sm text-[#8C1D18] dark:bg-[#3B1714] dark:text-[#FFB4AB]";

/** One order, for its buyer and for the shop that received it. */
function OrderView({ session, id }: { session: Session; id: string }) {
  const t = useTranslations("market.order");
  const tm = useTranslations("market");
  const ts = useTranslations("shop");
  const thb = useThb();
  const date = useDateFmt();
  const nameOf = useProductName();
  const router = useRouter();
  const uid = session.user.id;
  const {
    data,
    error: loadError,
    retry,
  } = useMarketQuery(
    async (s) => {
      const order = await s.getOrder(id);
      if (!order) return { order: null, shop: null, myShop: null };
      const [shop, myShop] = await Promise.all([s.getShopById(order.shopId), s.myShop(uid)]);
      return { order, shop, myShop };
    },
    [id, uid],
  );
  const [viewAs, setViewAs] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<"failed" | "suspended" | null>(null);

  const wrap = "mx-auto flex max-w-5xl flex-col gap-6 px-5 pt-6 pb-24 sm:px-8";
  if (data === undefined && loadError) {
    return (
      <div className={wrap}>
        <LoadError onRetry={retry} />
      </div>
    );
  }
  if (data === undefined) {
    return (
      <div className={wrap} aria-busy="true">
        <div className="h-10 w-56 animate-pulse rounded-full bg-surface" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface" />
        <div className="h-72 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const { order, shop, myShop } = data;
  const isBuyer = !!order && order.buyerId === uid;
  const isSeller = !!order && !!myShop && myShop.id === order.shopId;
  if (!order || (!isBuyer && !isSeller)) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-5 pt-16 pb-24 text-center">
        <CircleAlert className="size-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("notFoundTitle")}</h1>
        <p className="text-muted">{t("notFoundBody")}</p>
        <Link href="/orders" className="mt-3 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-bg">
          {t("toOrders")}
        </Link>
      </div>
    );
  }

  // Testing your own shop: the same account is both sides, so let it switch.
  const role: Role = isBuyer && isSeller ? (viewAs ?? "buyer") : isBuyer ? "buyer" : "shop";
  const allowed = NEXT_STATUS[order.status][role];

  const act = async (fn: (s: MarketStore) => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn(await getStore());
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      // bad-state: the order moved on meanwhile (e.g. a slip after it was cancelled or expired).
      // slip-rejected: the same file the shop already turned down (0005), so it needs a different one.
      const known = ["storage-full", "bad-image", "bad-state", "slip-rejected", "account-suspended"];
      setError(known.includes(code) ? code : "generic");
    } finally {
      setBusy(false);
    }
  };
  // The acting side goes with the change: the store refuses a move this side may not make.
  const setStatus = (status: OrderStatus, extra?: { tracking?: Order["tracking"]; cancelReason?: string }) =>
    act((s) => s.setOrderStatus(order.id, status, { ...extra, side: role }));

  const chat = async () => {
    setChatBusy(true);
    setChatError(null);
    try {
      router.push(
        role === "buyer"
          ? await openChat(order.shopId, uid, session.profile?.displayName || session.user.name)
          : await openChat(order.shopId, order.buyerId, order.address.name),
      );
    } catch (e) {
      // A suspended account may read its orders but not start a conversation (0005).
      setChatError(e instanceof Error && e.message === "account-suspended" ? "suspended" : "failed");
      setChatBusy(false);
    }
  };
  // Example shops exist only in this browser: on the real site there is nobody to chat with.
  const chatBlocked = isReadOnlyExample(shop);

  const count = order.items.reduce((n, it) => n + it.qty, 0);

  return (
    <div className={wrap}>
      <Link
        href={role === "buyer" ? "/orders" : "/seller"}
        className="-my-2 inline-flex items-center gap-1.5 self-start rounded-full py-1 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
        {role === "buyer" ? t("toOrders") : t("toSeller")}
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-muted">{t("title")}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight tabular-nums">{order.code}</h1>
            <StatusPill status={order.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {shop ? (
              <Link href={`/shops/${shop.slug}`} className="font-medium text-ink underline-offset-4 hover:underline">
                {shop.name}
              </Link>
            ) : (
              "–"
            )}
            {shop?.example && <ExampleBadge />}
            <span>· {date(order.createdAt)}</span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5 self-start sm:items-end sm:self-auto">
          <button type="button" onClick={chat} disabled={chatBusy || chatBlocked} aria-busy={chatBusy} className={`${secondaryBtn} h-10`}>
            <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {role === "buyer" ? t("chatShop") : t("chatBuyer")}
          </button>
          {chatBlocked && <p className="text-xs text-muted">{tm("exampleNoChat")}</p>}
          {chatError && (
            <p role="alert" className="text-xs text-[#B3261E] dark:text-[#FF8A80]">
              {chatError === "suspended" ? tm("shopPage.chatSuspended") : t("chatFailed")}
            </p>
          )}
        </div>
      </header>

      {isBuyer && isSeller && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm text-muted">{t("viewAs")}</span>
          <div role="radiogroup" aria-label={t("viewAs")} className="inline-flex self-start rounded-full bg-surface p-1">
            {(["buyer", "shop"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => {
                  setViewAs(r);
                  setError(null);
                }}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors aria-checked:bg-bg aria-checked:text-ink aria-checked:shadow-soft"
              >
                {t(`roles.${r}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {TEST_MODE && <TestModeBanner>{t("testBody")}</TestModeBanner>}

      <Timeline order={order} />

      {error && (
        <p role="alert" className={errorCls}>
          {t(`errors.${error}`)}
        </p>
      )}

      {/* What this side can do now */}
      {role === "buyer" ? (
        <BuyerPanel key={order.history.length} order={order} shop={shop} busy={busy} allowed={allowed} act={act} setStatus={setStatus} />
      ) : (
        <SellerPanel key={order.history.length} order={order} busy={busy} allowed={allowed} setStatus={setStatus} />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={card} aria-labelledby="order-items">
          <h2 id="order-items" className="text-lg font-semibold">
            {t("itemsTitle", { count })}
          </h2>
          <ul className="flex flex-col gap-3">
            {order.items.map((it) => (
              <li key={it.productId} className="flex items-center gap-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-surface p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image} alt="" className="max-h-full max-w-full object-contain" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{nameOf(it.productId, it.name)}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {ts("size", { w: it.widthMm, h: it.heightMm })} · {thb(it.priceThb)} × {it.qty}
                  </span>
                </span>
                <span className="text-sm tabular-nums">{thb(it.priceThb * it.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t border-hairline pt-3 text-sm">
            <dt className="text-muted">{tm("subtotal")}</dt>
            <dd className="text-right tabular-nums">{thb(order.subtotalThb)}</dd>
            <dt className="text-muted">{tm("shipping")}</dt>
            <dd className="text-right tabular-nums">{order.shippingThb === 0 ? tm("free") : thb(order.shippingThb)}</dd>
            <dt className="pt-1 font-semibold">{tm("total")}</dt>
            <dd className="pt-1 text-right text-lg font-semibold tabular-nums">{thb(order.totalThb)}</dd>
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <section className={card} aria-labelledby="order-address">
            <h2 id="order-address" className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t("addressTitle")}
            </h2>
            <address className="text-sm leading-relaxed not-italic">
              <span className="font-medium">{order.address.name}</span>
              <br />
              <span className="tabular-nums">{order.address.phone}</span>
              <br />
              <span className="whitespace-pre-line">{order.address.line1}</span>
              <br />
              {order.address.district} {order.address.province} <span className="tabular-nums">{order.address.postcode}</span>
            </address>
            {role === "shop" && <p className="text-xs leading-relaxed text-muted">{t("addressUse")}</p>}
          </section>
          {order.note && (
            <section className={card} aria-labelledby="order-note">
              <h2 id="order-note" className="font-semibold">
                {t("noteTitle")}
              </h2>
              <p className="text-sm leading-relaxed break-words whitespace-pre-line">{order.note}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- timeline ---------- */

function Timeline({ order }: { order: Order }) {
  const t = useTranslations("market");
  const date = useDateFmt();
  const at = (s: OrderStatus) => [...order.history].reverse().find((h) => h.status === s)?.at;
  const cancelled = order.status === "cancelled";
  // How far the order got; a rejected slip moves it back, so use the current status unless cancelled.
  const reached = cancelled
    ? Math.max(-1, ...order.history.filter((h) => h.status !== "cancelled").map((h) => ORDER_FLOW.indexOf(h.status)))
    : ORDER_FLOW.indexOf(order.status);

  return (
    <section aria-label={t("order.progress")} className="rounded-2xl border border-hairline bg-bg p-4 sm:p-6">
      <ol className="flex flex-col gap-3 sm:grid sm:grid-cols-5 sm:gap-2">
        {ORDER_FLOW.map((s, i) => {
          const done = i < reached || (i === reached && s === "completed");
          const current = i === reached && !cancelled && s !== "completed";
          const when = i <= reached ? at(s) : undefined;
          return (
            <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2" aria-current={current ? "step" : undefined}>
              <span className="flex w-full items-center gap-2 max-sm:w-auto">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    done ? "bg-ink text-bg" : current ? "bg-[#D7FF3A] text-[#111] ring-4 ring-[#D7FF3A]/30" : "border border-hairline text-muted"
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                </span>
                {i < ORDER_FLOW.length - 1 && <span className={`hidden h-px flex-1 sm:block ${i < reached ? "bg-ink" : "bg-hairline"}`} aria-hidden="true" />}
              </span>
              <span className="flex flex-col">
                <span className={`text-sm ${done || current ? "font-medium" : "text-muted"}`}>{t(`status.${s}`)}</span>
                {when && <span className="text-xs text-muted tabular-nums">{date(when)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface p-3 text-sm">
          <X className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            {t("order.cancelledAt", { when: date(at("cancelled") ?? order.createdAt) })}
            {order.cancelReason && (
              <>
                <br />
                <span className="text-muted">
                  {t("order.reason", {
                    // Reasons the system sets (expiry, shop closed by staff) are codes: say them in words.
                    reason:
                      order.cancelReason === "expired" || order.cancelReason === "shop-unavailable"
                        ? t(`order.cancelReasons.${order.cancelReason}`)
                        : order.cancelReason,
                  })}
                </span>
              </>
            )}
          </span>
        </p>
      )}
    </section>
  );
}

/* ---------- buyer ---------- */

function BuyerPanel({
  order,
  shop,
  busy,
  allowed,
  act,
  setStatus,
}: {
  order: Order;
  shop: Shop | null;
  busy: boolean;
  allowed: OrderStatus[];
  act: (fn: (s: MarketStore) => Promise<unknown>) => Promise<void>;
  setStatus: (s: OrderStatus, extra?: { cancelReason?: string }) => Promise<void>;
}) {
  const t = useTranslations("market.order");
  const thb = useThb();
  const fileRef = useRef<HTMLInputElement>(null);
  const [slip, setSlip] = useState<string | null>(null);
  const [slipError, setSlipError] = useState(false);

  if (order.status === "awaiting_payment") {
    const example = !!shop?.example;
    // The PromptPay captured when the order was placed (0004) wins over the shop's current one.
    const pp = order.promptpay ?? shop?.promptpay;
    const pick = async (f: File | undefined) => {
      setSlipError(false);
      if (!f) return;
      try {
        setSlip(await fileToDataUrl(f, 1200));
      } catch {
        setSlipError(true);
      }
    };
    return (
      <section className={card} aria-labelledby="pay-title">
        <h2 id="pay-title" className="text-xl font-semibold">
          {t("pay.title")}
        </h2>
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <div className="flex flex-col items-center gap-2">
            <PromptPayQr
              id={pp?.id}
              amountThb={order.totalThb}
              example={example}
              size={240}
              label={example ? t("pay.exampleQr") : pp ? t("pay.qrLabel", { amount: thb(order.totalThb), name: pp.name }) : t("pay.noQr")}
            />
            {!example && pp && <p className="text-xs text-muted">PromptPay</p>}
          </div>
          <div className="flex flex-col gap-4">
            {example && (
              <p className="flex gap-2 rounded-xl border border-dashed border-ink/40 p-3 text-sm font-medium">
                <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                {t("pay.exampleNote")}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">{t("pay.amount")}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{thb(order.totalThb)}</dd>
              {pp && !example && (
                <>
                  <dt className="text-muted">{t("pay.accountName")}</dt>
                  <dd className="font-medium">{pp.name}</dd>
                </>
              )}
              <dt className="text-muted">{t("pay.code")}</dt>
              <dd className="font-medium tabular-nums">{order.code}</dd>
            </dl>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed text-muted">
              <li>{t("pay.step1")}</li>
              <li>{pp && !example ? t("pay.step2", { name: pp.name }) : t("pay.step2Generic")}</li>
              <li>{t("pay.step3")}</li>
            </ol>
            {!pp && !example && <p className="text-sm text-muted">{t("pay.noQrHint")}</p>}

            <div className="flex flex-col gap-3 border-t border-hairline pt-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => void pick(e.target.files?.[0])}
              />
              {slip ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slip} alt={t("slipPreview")} className="max-h-56 w-auto self-start rounded-xl border border-hairline" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => act((s) => s.submitSlip(order.id, slip))} className={`${primaryBtn} h-11`}>
                      <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                      {t("sendSlip")}
                    </button>
                    <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={`${secondaryBtn} h-11`}>
                      {t("chooseAnother")}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className={`${primaryBtn} h-12 self-start px-6`}>
                  <ImageUp className="size-4" strokeWidth={2} aria-hidden="true" />
                  {t("uploadSlip")}
                </button>
              )}
              {slipError && (
                <p role="alert" className={errorCls}>
                  {t("errors.bad-image")}
                </p>
              )}
            </div>
          </div>
        </div>
        {allowed.includes("cancelled") && (
          <CancelBox busy={busy} onCancel={(reason) => setStatus("cancelled", reason ? { cancelReason: reason } : undefined)} />
        )}
      </section>
    );
  }

  if (order.status === "slip_submitted") {
    return (
      <Notice icon={<Check className="size-5" strokeWidth={2} aria-hidden="true" />} title={t("buyer.slipTitle")} body={t("buyer.slipBody")}>
        {order.slip && <SlipThumb src={order.slip} />}
      </Notice>
    );
  }
  if (order.status === "paid")
    return <Notice icon={<PackageCheck className="size-5" strokeWidth={1.75} aria-hidden="true" />} title={t("buyer.paidTitle")} body={t("buyer.paidBody")} />;
  if (order.status === "shipped") {
    return (
      <Notice icon={<Truck className="size-5" strokeWidth={1.75} aria-hidden="true" />} title={t("buyer.shippedTitle")} body={t("buyer.shippedBody")}>
        <Tracking order={order} />
        {allowed.includes("completed") && (
          <button type="button" disabled={busy} onClick={() => setStatus("completed")} className={`${primaryBtn} h-12 self-start px-6`}>
            <PackageCheck className="size-4" strokeWidth={2} aria-hidden="true" />
            {t("received")}
          </button>
        )}
      </Notice>
    );
  }
  if (order.status === "completed")
    return <Notice icon={<Check className="size-5" strokeWidth={2} aria-hidden="true" />} title={t("buyer.doneTitle")} body={t("buyer.doneBody")} />;
  return null;
}

/* ---------- seller ---------- */

function SellerPanel({
  order,
  busy,
  allowed,
  setStatus,
}: {
  order: Order;
  busy: boolean;
  allowed: OrderStatus[];
  setStatus: (s: OrderStatus, extra?: { tracking?: Order["tracking"]; cancelReason?: string }) => Promise<void>;
}) {
  const t = useTranslations("market.order");
  const tc = useTranslations("market.carriers");
  const thb = useThb();
  const formId = useId();
  const [carrier, setCarrier] = useState<string>(CARRIERS[0]);
  const [tracking, setTracking] = useState("");
  const [trackingError, setTrackingError] = useState(false);
  const cancel = allowed.includes("cancelled") && (
    <CancelBox busy={busy} requireReason onCancel={(reason) => setStatus("cancelled", { cancelReason: reason })} />
  );

  if (order.status === "awaiting_payment") {
    return (
      <Notice
        icon={<ImageUp className="size-5" strokeWidth={1.75} aria-hidden="true" />}
        title={t("seller.waitingTitle")}
        body={t("seller.waitingBody", { amount: thb(order.totalThb) })}
      >
        {cancel}
      </Notice>
    );
  }

  if (order.status === "slip_submitted") {
    return (
      <section className={card} aria-labelledby="check-slip">
        <h2 id="check-slip" className="text-xl font-semibold">
          {t("seller.checkTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{t("seller.checkBody", { amount: thb(order.totalThb), code: order.code })}</p>
        {order.slip && <SlipThumb src={order.slip} large />}
        <div className="flex flex-wrap gap-2">
          {allowed.includes("paid") && (
            <button type="button" disabled={busy} onClick={() => setStatus("paid")} className={`${primaryBtn} h-12 px-6`}>
              <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              {t("seller.confirm")}
            </button>
          )}
          {allowed.includes("awaiting_payment") && (
            <button type="button" disabled={busy} onClick={() => setStatus("awaiting_payment")} className={`${secondaryBtn} h-12`}>
              <X className="size-4" strokeWidth={2} aria-hidden="true" />
              {t("seller.reject")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted">{t("seller.rejectHint")}</p>
      </section>
    );
  }

  if (order.status === "paid") {
    const ship = (e: FormEvent) => {
      e.preventDefault();
      if (!tracking.trim()) {
        setTrackingError(true);
        document.getElementById(`${formId}-no`)?.focus();
        return;
      }
      void setStatus("shipped", { tracking: { carrier, number: tracking.trim() } });
    };
    return (
      <section className={card} aria-labelledby="ship-title">
        <h2 id="ship-title" className="text-xl font-semibold">
          {t("seller.shipTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{t("seller.shipBody")}</p>
        {order.slip && <SlipThumb src={order.slip} />}
        {allowed.includes("shipped") && (
          <form onSubmit={ship} noValidate className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-carrier`} className="text-sm font-medium">
                {t("seller.carrier")}
              </label>
              <select id={`${formId}-carrier`} value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls}>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {tc(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-no`} className="text-sm font-medium">
                {t("seller.trackingNo")}
              </label>
              <input
                id={`${formId}-no`}
                value={tracking}
                maxLength={60}
                autoComplete="off"
                onChange={(e) => {
                  setTracking(e.target.value);
                  setTrackingError(false);
                }}
                aria-invalid={trackingError}
                aria-describedby={trackingError ? `${formId}-no-err` : undefined}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={busy} className={`${primaryBtn} h-11 px-6`}>
              <Truck className="size-4" strokeWidth={2} aria-hidden="true" />
              {t("seller.markShipped")}
            </button>
            {trackingError && (
              <p id={`${formId}-no-err`} className="text-xs text-[#B3261E] sm:col-span-3 dark:text-[#FF8A80]">
                {t("seller.trackingRequired")}
              </p>
            )}
          </form>
        )}
        {cancel}
      </section>
    );
  }

  if (order.status === "shipped") {
    return (
      <Notice icon={<Truck className="size-5" strokeWidth={1.75} aria-hidden="true" />} title={t("seller.shippedTitle")} body={t("seller.shippedBody")}>
        <Tracking order={order} />
      </Notice>
    );
  }
  if (order.status === "completed")
    return <Notice icon={<Check className="size-5" strokeWidth={2} aria-hidden="true" />} title={t("seller.doneTitle")} body={t("seller.doneBody")} />;
  return null;
}

/* ---------- small pieces ---------- */

function Notice({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <section className={card}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D7FF3A] text-[#111]">{icon}</span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm leading-relaxed text-muted">{body}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Tracking({ order }: { order: Order }) {
  const t = useTranslations("market.order");
  const tc = useTranslations("market.carriers");
  if (!order.tracking) return null;
  const known = (CARRIERS as readonly string[]).includes(order.tracking.carrier);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-surface p-3 text-sm">
      <dt className="text-muted">{t("seller.carrier")}</dt>
      <dd className="font-medium">{known ? tc(order.tracking.carrier as (typeof CARRIERS)[number]) : order.tracking.carrier}</dd>
      <dt className="text-muted">{t("seller.trackingNo")}</dt>
      <dd className="font-medium break-all tabular-nums select-all">{order.tracking.number}</dd>
    </dl>
  );
}

/** Slip thumbnail that opens full size in a modal dialog. */
function SlipThumb({ src, large = false }: { src: string; large?: boolean }) {
  const t = useTranslations("market.order");
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="group relative self-start overflow-hidden rounded-xl border border-hairline"
        aria-label={t("slipEnlarge")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className={`w-auto object-contain transition-opacity group-hover:opacity-90 ${large ? "max-h-80" : "max-h-40"}`} />
      </button>
      <dialog
        ref={dialog}
        aria-label={t("slipTitle")}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[92dvh] max-w-[min(92vw,40rem)] rounded-2xl bg-bg p-0 backdrop:bg-black/70"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
            <p className="text-sm font-medium">{t("slipTitle")}</p>
            <button
              type="button"
              autoFocus
              onClick={() => dialog.current?.close()}
              className="grid size-9 place-items-center rounded-full hover:bg-surface"
              aria-label={t("close")}
            >
              <X className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={t("slipTitle")} className="max-h-[80dvh] w-auto object-contain" />
        </div>
      </dialog>
    </>
  );
}

/** Cancel with an in-page confirmation (no browser dialogs). */
function CancelBox({ busy, requireReason = false, onCancel }: { busy: boolean; requireReason?: boolean; onCancel: (reason: string) => void }) {
  const t = useTranslations("market.order.cancel");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full px-1 py-1 text-sm text-muted underline underline-offset-4 hover:text-ink"
      >
        {t("open")}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-4" role="group" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="font-medium">
        {t("title")}
      </p>
      <p className="text-sm text-muted">{t("body")}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-reason`} className="text-sm font-medium">
          {t("reason")} {!requireReason && <span className="font-normal text-muted">({t("optional")})</span>}
        </label>
        <input
          id={`${id}-reason`}
          value={reason}
          maxLength={200}
          onChange={(e) => {
            setReason(e.target.value);
            setMissing(false);
          }}
          aria-invalid={missing}
          className={inputCls}
        />
        {missing && <p className="text-xs text-[#B3261E] dark:text-[#FF8A80]">{t("reasonRequired")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {/* The safe choice takes focus, so a stray Enter doesn't cancel the order. */}
        <button type="button" autoFocus onClick={() => setOpen(false)} className={`${secondaryBtn} h-10 bg-bg`}>
          {t("keep")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (requireReason && !reason.trim()) return setMissing(true);
            onCancel(reason.trim());
          }}
          className="inline-flex h-10 items-center rounded-full bg-[#B3261E] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}
