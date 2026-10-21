"use client";

import { ArrowLeft, Lock, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { AuthGate } from "@/components/AuthGate";
import { canCheckout, cart, getStore, isReadOnlyExample, shippingFor, TEST_MODE, useCart, useCartReady, useMarketQuery } from "@/features/market/store";
import { ExampleBadge, inputCls, LoadError, primaryBtn, TestModeBanner, useHydrated, useProductName, useThb } from "@/features/market/ui/buyer";
import type { Address } from "@/features/market/types";
import { Link, useRouter } from "@/i18n/navigation";
import type { Session } from "@/lib/session";

/** Saved per account (`peelplan.address.v1:<userId>`): the next person on this device must not get it. */
const ADDRESS_KEY = "peelplan.address.v1";
const addressKey = (userId: string) => `${ADDRESS_KEY}:${userId}`;
const EMPTY_ADDRESS: Address = { name: "", phone: "", line1: "", district: "", province: "", postcode: "" };
const FIELDS: { key: keyof Address; auto: string; wide?: boolean; inputMode?: "tel" | "numeric"; max: number }[] = [
  { key: "name", auto: "name", max: 80 },
  { key: "phone", auto: "tel", inputMode: "tel", max: 20 },
  { key: "line1", auto: "street-address", wide: true, max: 200 },
  { key: "district", auto: "address-level3", max: 80 },
  { key: "province", auto: "address-level1", max: 80 },
  { key: "postcode", auto: "postal-code", inputMode: "numeric", max: 5 },
];

function loadAddress(userId: string): Address {
  try {
    // Older builds kept one device-wide address; it can't be told apart from another account's, so drop it.
    localStorage.removeItem(ADDRESS_KEY);
    const raw = localStorage.getItem(addressKey(userId));
    return raw ? { ...EMPTY_ADDRESS, ...(JSON.parse(raw) as Partial<Address>) } : EMPTY_ADDRESS;
  } catch {
    return EMPTY_ADDRESS;
  }
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Codes place_order / the test store raise that have their own message; anything else is "generic". */
const SUBMIT_ERRORS = [
  "out-of-stock",
  "shop-unavailable",
  "product-unavailable",
  "storage-full",
  "own-shop",
  "too-many-open-orders",
  "too-many-units",
  "bad-lines",
  "bad-address",
  "not-onboarded",
  "not-signed-in",
  "rate-limited",
  // 0005: staff suspended this account, so it can't start anything new.
  "account-suspended",
] as const;
type SubmitError = (typeof SUBMIT_ERRORS)[number] | "generic";
const toSubmitError = (code: string): SubmitError => ((SUBMIT_ERRORS as readonly string[]).includes(code) ? (code as SubmitError) : "generic");
/** Errors fixed by changing the cart, so offer the way back to it. */
const CART_FIXABLE: SubmitError[] = ["out-of-stock", "product-unavailable", "bad-lines", "too-many-units"];

function validate(a: Address): Partial<Record<keyof Address, "required" | "phone" | "postcode">> {
  const e: Partial<Record<keyof Address, "required" | "phone" | "postcode">> = {};
  for (const f of FIELDS) if (!a[f.key].trim()) e[f.key] = "required";
  // Thai numbers: 9 digits (landline) or 10 (mobile), starting with 0.
  if (!e.phone && !/^0\d{8,9}$/.test(digits(a.phone))) e.phone = "phone";
  if (!e.postcode && !/^\d{5}$/.test(a.postcode.trim())) e.postcode = "postcode";
  return e;
}

export function CheckoutGate({ shopId }: { shopId: string }) {
  return <AuthGate>{(session) => <CheckoutView session={session} shopId={shopId} />}</AuthGate>;
}

function CheckoutView({ session, shopId }: { session: Session; shopId: string }) {
  const t = useTranslations("market.checkout");
  const tm = useTranslations("market");
  const ts = useTranslations("shop");
  const thb = useThb();
  const nameOf = useProductName();
  const router = useRouter();
  const hydrated = useHydrated();
  const formId = useId();
  const lines = useCart().filter((l) => l.shopId === shopId);
  const cartReady = useCartReady();
  const key = lines.map((l) => l.productId).join(",");
  const { data, error, retry } = useMarketQuery(
    async (s) => ({ shop: await s.getShopById(shopId), products: await s.getProducts(key ? key.split(",") : []) }),
    [shopId, key],
  );

  // AuthGate renders this on the client only, so this account's saved address is available on first render.
  const [address, setAddress] = useState<Address>(() => loadAddress(session.user.id));
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [agreeError, setAgreeError] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(false);

  const back = (
    <Link href="/cart" className="-my-2 inline-flex items-center gap-1.5 self-start rounded-full py-1 text-sm text-muted transition-colors hover:text-ink">
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
      {t("backToCart")}
    </Link>
  );
  const wrap = "mx-auto flex max-w-5xl flex-col gap-8 px-5 pt-6 pb-24 sm:px-8";

  if (hydrated && !data && error && !placed) {
    return (
      <div className={wrap}>
        {back}
        <LoadError onRetry={retry} />
      </div>
    );
  }

  if (!hydrated || !cartReady || !data || placed) {
    return (
      <div className={wrap} aria-busy="true">
        <div className="h-10 w-48 animate-pulse rounded-full bg-surface" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const { shop } = data;
  const products = new Map(data.products.map((p) => [p.id, p]));
  if (!shop || lines.length === 0) {
    return (
      <div className={wrap}>
        {back}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-16 text-center">
          <p className="text-lg font-semibold">{t("nothingTitle")}</p>
          <p className="max-w-[44ch] text-sm text-muted">{t("nothingBody")}</p>
        </div>
      </div>
    );
  }

  // Examples on the real site, unapproved shops and shops without PromptPay (0004) can't take orders.
  if (!canCheckout(shop)) {
    return (
      <div className={wrap}>
        {back}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-16 text-center">
          <p className="flex flex-wrap items-center justify-center gap-2 text-lg font-semibold">
            {shop.name}
            {shop.example && <ExampleBadge />}
          </p>
          <p className="max-w-[44ch] text-sm text-muted">
            {isReadOnlyExample(shop) ? t("blocked.example") : shop.status === "approved" ? t("blocked.noPayment") : t("blocked.closed")}
          </p>
        </div>
      </div>
    );
  }

  const items = lines.flatMap((l) => {
    const p = products.get(l.productId);
    return p ? [{ p, qty: l.qty }] : [];
  });
  const subtotal = items.reduce((n, it) => n + it.p.priceThb * it.qty, 0);
  const shipping = shippingFor(shop, subtotal);
  const total = subtotal + shipping;

  const set = (k: keyof Address, v: string) => {
    setAddress((a) => ({ ...a, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const clean: Address = { ...address, phone: digits(address.phone), postcode: address.postcode.trim() };
    const errs = validate(clean);
    setErrors(errs);
    setAgreeError(!agree);
    const first = FIELDS.find((f) => errs[f.key]);
    if (first) return document.getElementById(`${formId}-${first.key}`)?.focus();
    if (!agree) return document.getElementById(`${formId}-agree`)?.focus();

    setBusy(true);
    try {
      const s = await getStore();
      const order = await s.placeOrder({
        buyerId: session.user.id,
        shopId,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        address: Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, v.trim()])) as Address,
        note: note.trim(),
      });
      try {
        localStorage.setItem(addressKey(session.user.id), JSON.stringify(clean));
      } catch {
        /* storage unavailable */
      }
      setPlaced(true);
      cart.clearShop(shopId);
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setSubmitError(toSubmitError(err instanceof Error ? err.message : ""));
      setBusy(false);
    }
  };

  const fieldError = (k: keyof Address) => errors[k] && t(`errors.${errors[k]}`);

  return (
    <div className={wrap}>
      {back}
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.02em]">{t("title")}</h1>
        <p className="flex flex-wrap items-center gap-2 text-muted">
          {t("from", { shop: shop.name })}
          {shop.example && <ExampleBadge />}
        </p>
      </header>
      {TEST_MODE && <TestModeBanner />}

      <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-8">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-4 text-lg font-semibold">{t("addressTitle")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => {
                const id = `${formId}-${f.key}`;
                const err = fieldError(f.key);
                return (
                  <div key={f.key} className={`flex flex-col gap-1.5 ${f.wide ? "sm:col-span-2" : ""}`}>
                    <label htmlFor={id} className="text-sm font-medium">
                      {t(`fields.${f.key}`)}
                    </label>
                    {f.key === "line1" ? (
                      <textarea
                        id={id}
                        rows={2}
                        value={address[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        autoComplete={f.auto}
                        maxLength={f.max}
                        required
                        placeholder={t("placeholders.line1")}
                        aria-invalid={!!err}
                        aria-describedby={err ? `${id}-err` : undefined}
                        className={`${inputCls} h-auto py-2.5 leading-relaxed`}
                      />
                    ) : (
                      <input
                        id={id}
                        value={address[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        autoComplete={f.auto}
                        inputMode={f.inputMode}
                        type={f.key === "phone" ? "tel" : "text"}
                        maxLength={f.max}
                        required
                        placeholder={f.key === "phone" || f.key === "postcode" ? t(`placeholders.${f.key}`) : undefined}
                        aria-invalid={!!err}
                        aria-describedby={err ? `${id}-err` : undefined}
                        className={inputCls}
                      />
                    )}
                    {err && (
                      <p id={`${id}-err`} className="text-xs text-[#B3261E] dark:text-[#FF8A80]">
                        {err}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-note`} className="text-sm font-medium">
              {t("note")} <span className="font-normal text-muted">({t("optional")})</span>
            </label>
            <textarea
              id={`${formId}-note`}
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              className={`${inputCls} h-auto py-2.5 leading-relaxed`}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-hairline p-4 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t("pdpaTitle")}
            </p>
            <p className="text-sm leading-relaxed text-muted">
              {t.rich("pdpaBody", {
                shop: shop.name,
                link: (chunks) => (
                  <Link href="/legal/privacy" className="text-ink underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                id={`${formId}-agree`}
                type="checkbox"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  if (e.target.checked) setAgreeError(false);
                }}
                aria-invalid={agreeError}
                aria-describedby={agreeError ? `${formId}-agree-err` : undefined}
                className="mt-0.5 size-5 shrink-0 accent-[#111] dark:accent-[#D7FF3A]"
              />
              <span>{t("agree", { shop: shop.name })}</span>
            </label>
            {agreeError && (
              <p id={`${formId}-agree-err`} className="text-xs text-[#B3261E] dark:text-[#FF8A80]">
                {t("errors.agree")}
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        <aside className="flex flex-col gap-4 rounded-2xl border border-hairline bg-bg p-4 sm:p-5 lg:sticky lg:top-24" aria-labelledby={`${formId}-summary`}>
          <h2 id={`${formId}-summary`} className="text-lg font-semibold">
            {t("summary")}
          </h2>
          <ul className="flex flex-col gap-3">
            {items.map(({ p, qty }) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-surface p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" className="max-h-full max-w-full object-contain" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{nameOf(p.id, p.name)}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {ts("size", { w: p.widthMm, h: p.heightMm })} · ×{qty}
                  </span>
                </span>
                <span className="text-sm tabular-nums">{thb(p.priceThb * qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t border-hairline pt-3 text-sm">
            <dt className="text-muted">{tm("subtotal")}</dt>
            <dd className="text-right tabular-nums">{thb(subtotal)}</dd>
            <dt className="text-muted">{tm("shipping")}</dt>
            <dd className="text-right tabular-nums">{shipping === 0 ? tm("free") : thb(shipping)}</dd>
            <dt className="pt-1 font-semibold">{tm("total")}</dt>
            <dd className="pt-1 text-right text-xl font-semibold tabular-nums">{thb(total)}</dd>
          </dl>
          <p className="flex gap-2 rounded-xl bg-surface p-3 text-xs leading-relaxed text-muted">
            <QrCode className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {t("payNext")}
          </p>
          {submitError && (
            <p role="alert" className="rounded-xl bg-[#FDECEA] p-3 text-sm text-[#8C1D18] dark:bg-[#3B1714] dark:text-[#FFB4AB]">
              {t(`submitErrors.${submitError}`)}{" "}
              {CART_FIXABLE.includes(submitError) && (
                <Link href="/cart" className="font-medium underline underline-offset-4">
                  {t("backToCart")}
                </Link>
              )}
            </p>
          )}
          <button type="submit" disabled={busy} aria-busy={busy} className={`${primaryBtn} h-12 w-full text-base`}>
            {busy ? t("placing") : t("place", { total: thb(total) })}
          </button>
        </aside>
      </form>
    </div>
  );
}
