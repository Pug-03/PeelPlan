"use client";

import { Check, ExternalLink, PanelRight, RotateCcw, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/features/chat/Modal";
import { getStore, useMarket } from "@/features/market/store";
import type { AdminShop, ShopStatus } from "@/features/market/types";
import { Link } from "@/i18n/navigation";
import { fieldClass, primaryBtn } from "../seller/ui";
import { Empty, FilterChips, Pill, Skeleton, TableBox, td, th, useDay, useNumber, type Tone } from "./ui";

export const SHOP_FILTERS = ["all", "pending", "approved", "rejected"] as const;
export type ShopFilter = (typeof SHOP_FILTERS)[number];

const TONE: Record<ShopStatus, Tone> = { pending: "warn", approved: "good", rejected: "bad" };

export function ShopStatusPill({ status }: { status: ShopStatus }) {
  const t = useTranslations("admin.shops.status");
  return <Pill tone={TONE[status]}>{t(status)}</Pill>;
}

/** The status change being confirmed: rejecting needs a reason; sending back to review may have one. */
type Pending = { shop: AdminShop; status: ShopStatus };

export function ShopsTab({ filter, setFilter }: { filter: ShopFilter; setFilter: (f: ShopFilter) => void }) {
  const t = useTranslations("admin.shops");
  const day = useDay();
  const n = useNumber();
  const shops = useMarket((s) => s.listAllShops?.() ?? Promise.resolve([] as AdminShop[]), []);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const list = (shops ?? []).filter(
    (s) => (filter === "all" || s.status === filter) && (!q || [s.name, s.slug, s.ownerName, s.city].some((v) => v?.toLowerCase().includes(q))),
  );
  const count = (f: ShopFilter) => (shops ?? []).filter((s) => f === "all" || s.status === f).length;
  const open = shops?.find((s) => s.id === detail) ?? null;

  const apply = async (shop: AdminShop, status: ShopStatus, reason?: string) => {
    setBusy(shop.id);
    setError(null);
    try {
      const store = await getStore();
      if (!store.setShopStatus) throw new Error("unsupported");
      await store.setShopStatus(shop.id, status, reason);
      setConfirm(null);
    } catch (e) {
      setError(t("errors.save", { name: shop.name }) + (e instanceof Error && e.message === "not-admin" ? ` (${t("errors.notAdmin")})` : ""));
    } finally {
      setBusy(null);
    }
  };
  /** Approve right away; anything that hides a shop asks first (with a reason for the seller). */
  const act = (shop: AdminShop, status: ShopStatus) => (status === "approved" ? void apply(shop, status) : setConfirm({ shop, status }));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips label={t("filter")} options={SHOP_FILTERS} value={filter} onChange={setFilter} text={(k) => t(`filters.${k}`)} count={count} />
        <label className="relative block lg:w-72">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className={`${fieldClass} pl-10`} />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDE2E2] px-4 py-3 text-sm text-[#8A1F24]">
          {error}
        </p>
      )}

      {shops === undefined ? (
        <Skeleton h="h-64" />
      ) : list.length === 0 ? (
        <Empty title={q ? t("noMatch") : t("empty")} body={q ? undefined : t("emptyBody")} />
      ) : (
        <TableBox label={t("tableLabel")}>
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-hairline">
              <tr>
                <th scope="col" className={th}>
                  {t("cols.shop")}
                </th>
                <th scope="col" className={th}>
                  {t("cols.owner")}
                </th>
                <th scope="col" className={th}>
                  {t("cols.created")}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  {t("cols.products")}
                </th>
                <th scope="col" className={th}>
                  {t("cols.promptpay")}
                </th>
                <th scope="col" className={th}>
                  {t("cols.status")}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  {t("cols.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {list.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-surface/60">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-semibold text-[#111]" style={{ background: s.tint }} aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element -- data URLs in test mode */}
                        {s.logo ? <img src={s.logo} alt="" className="size-full object-cover" /> : s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <button type="button" onClick={() => setDetail(s.id)} className="block max-w-[14rem] truncate text-left font-medium hover:underline">
                          {s.name}
                        </button>
                        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
                          /{s.slug}
                          {s.example && <Pill tone="neutral">{t("example")}</Pill>}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className={`${td} max-w-[12rem] truncate`}>{s.ownerName || <span className="text-muted">–</span>}</td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{day(s.createdAt)}</td>
                  <td className={`${td} text-right tabular-nums`}>{n(s.productCount)}</td>
                  <td className={td}>{s.example ? <span className="text-muted">–</span> : s.promptpay ? <Pill tone="good">{t("ppSet")}</Pill> : <Pill tone="neutral">{t("ppMissing")}</Pill>}</td>
                  <td className={td}>
                    <ShopStatusPill status={s.status} />
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex items-center justify-end gap-1.5">
                      {!s.example && <StatusActions shop={s} busy={busy === s.id} onAct={act} compact />}
                      <button type="button" onClick={() => setDetail(s.id)} aria-label={t("detailsFor", { name: s.name })} title={t("details")} className={iconBtn}>
                        <PanelRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      )}

      <Drawer shop={open} onClose={() => setDetail(null)} busy={busy === open?.id} onAct={act} />
      <ReasonDialog pending={confirm} busy={!!busy} onClose={() => setConfirm(null)} onConfirm={(reason) => confirm && void apply(confirm.shop, confirm.status, reason)} />
    </div>
  );
}

const iconBtn = "grid size-9 shrink-0 place-items-center rounded-full border border-hairline text-muted transition-colors hover:border-ink hover:text-ink";
const smallBtn = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3 text-sm font-medium whitespace-nowrap transition-colors hover:border-ink disabled:opacity-50";

function StatusActions({ shop, busy, onAct, compact }: { shop: AdminShop; busy: boolean; onAct: (s: AdminShop, st: ShopStatus) => void; compact?: boolean }) {
  const t = useTranslations("admin.shops.actions");
  const approve = (
    <button key="a" type="button" disabled={busy} onClick={() => onAct(shop, "approved")} className={`${smallBtn} border-transparent bg-[#D7FF3A] text-[#111] hover:border-transparent hover:opacity-90`}>
      <Check className="size-4" strokeWidth={2} aria-hidden="true" />
      {t("approve")}
    </button>
  );
  const reject = (
    <button key="r" type="button" disabled={busy} onClick={() => onAct(shop, "rejected")} className={smallBtn}>
      <X className="size-4" strokeWidth={2} aria-hidden="true" />
      {t("reject")}
    </button>
  );
  const review = (
    <button key="p" type="button" disabled={busy} onClick={() => onAct(shop, "pending")} className={smallBtn}>
      <RotateCcw className="size-4" strokeWidth={2} aria-hidden="true" />
      {t("suspend")}
    </button>
  );
  const items = shop.status === "pending" ? [approve, reject] : shop.status === "approved" ? (compact ? [review] : [review, reject]) : [approve, review];
  return <>{items}</>;
}

function Drawer({ shop, onClose, busy, onAct }: { shop: AdminShop | null; onClose: () => void; busy: boolean; onAct: (s: AdminShop, st: ShopStatus) => void }) {
  const t = useTranslations("admin.shops");
  const ta = useTranslations("auth");
  const day = useDay();
  const n = useNumber();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (shop && !d.open) d.showModal();
    if (!shop && d.open) d.close();
  }, [shop]);

  const rows: [string, React.ReactNode][] = shop
    ? [
        [t("cols.owner"), shop.ownerName || "–"],
        [t("cols.created"), day(shop.createdAt)],
        [t("detail.city"), shop.city || "–"],
        [t("detail.types"), shop.productTypes.map((p) => ta(`products.${p}`)).join(" · ") || "–"],
        [t("cols.products"), n(shop.productCount)],
        [t("detail.orders"), t("detail.ordersValue", { total: shop.orderCount, recent: shop.recentOrderCount })],
        [t("cols.promptpay"), shop.promptpay ? `${shop.promptpay.name} · ${shop.promptpay.id.replace(/^(\d{3})\d+(\d{3})$/, "$1•••$2")}` : t("ppMissing")],
        [t("detail.shipping"), `฿${shop.shippingThb}${shop.freeShippingFromThb ? ` · ${t("detail.freeFrom", { n: shop.freeShippingFromThb })}` : ""}`],
        [t("detail.links"), Object.keys(shop.links).length ? Object.keys(shop.links).join(", ") : "–"],
      ]
    : [];

  return (
    <dialog
      ref={ref}
      aria-label={shop ? t("detailsFor", { name: shop.name }) : t("details")}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(28rem,100vw)] max-w-none overflow-y-auto border-l border-hairline bg-bg p-0 text-ink backdrop:bg-black/40"
    >
      {shop && (
        <div className="flex min-h-full flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg font-semibold text-[#111]" style={{ background: shop.tint }} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URLs in test mode */}
              {shop.logo ? <img src={shop.logo} alt="" className="size-full object-cover" /> : shop.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{shop.name}</h2>
              <p className="text-sm text-muted">/{shop.slug}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={t("close")} className={iconBtn}>
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShopStatusPill status={shop.status} />
            {shop.example && <Pill tone="neutral">{t("example")}</Pill>}
          </div>
          {shop.statusReason && (
            <p className="rounded-xl bg-surface px-3 py-2 text-sm">
              <span className="font-medium">{t("detail.reason")}:</span> {shop.statusReason}
            </p>
          )}
          {shop.about && <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{shop.about}</p>}
          <dl className="divide-y divide-hairline rounded-2xl border border-hairline text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex flex-wrap gap-2 border-t border-hairline pt-4">
            <Link href={`/shops/${shop.slug}`} target="_blank" className={smallBtn}>
              <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t("actions.view")}
            </Link>
            {shop.example ? <p className="self-center text-xs text-muted">{t("exampleNote")}</p> : <StatusActions shop={shop} busy={busy} onAct={onAct} />}
          </div>
        </div>
      )}
    </dialog>
  );
}

function ReasonDialog({ pending, busy, onClose, onConfirm }: { pending: Pending | null; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const t = useTranslations("admin.shops.confirm");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const reject = pending?.status === "rejected";

  const close = () => {
    setReason("");
    setError(false);
    onClose();
  };

  return (
    <Modal open={!!pending} onClose={close} label={reject ? t("rejectTitle") : t("suspendTitle")} closeLabel={t("cancel")}>
      {pending && (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reject && !reason.trim()) return setError(true);
            onConfirm(reason.trim());
            setReason("");
            setError(false);
          }}
        >
          <div className="pr-10">
            <h2 className="text-lg font-semibold">{reject ? t("rejectTitle") : t("suspendTitle")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t(reject ? "rejectBody" : "suspendBody", { name: pending.shop.name })}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="status-reason" className="text-sm font-medium">
              {reject ? t("reason") : t("reasonOptional")}
            </label>
            <textarea
              id="status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              aria-invalid={error || undefined}
              aria-describedby={error ? "status-reason-error" : "status-reason-hint"}
              className={`${fieldClass} h-auto resize-none py-3`}
            />
            {error ? (
              <p id="status-reason-error" className="text-sm text-[#C62F35]">
                {t("reasonRequired")}
              </p>
            ) : (
              <p id="status-reason-hint" className="text-xs text-muted">
                {t("reasonHint")}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="h-10 rounded-full px-4 text-sm font-medium text-muted hover:bg-surface hover:text-ink">
              {t("cancel")}
            </button>
            <button type="submit" disabled={busy} className={`${primaryBtn} h-10`}>
              {reject ? t("rejectSubmit") : t("suspendSubmit")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
