"use client";

import { ImagePlus, Pencil, Plus, Ruler, Search, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { fileToDataUrl, getStore, useMarketQuery } from "@/features/market/store";
import { LoadError } from "@/features/market/ui/buyer";
import { FINISHES, type Product, type Shop } from "@/features/market/types";
import { VISIBLE_LIBRARY, stickerThumb } from "@/stickers/library";
import { validateProduct, type Errors, type ProductDraft, type ProductField } from "./validate";
import { ariaFor, Field, fieldClass, primaryBtn, secondaryBtn, useMoney, useUnsavedGuard } from "./ui";

const EMPTY: ProductDraft = { name: "", image: "", widthMm: "", heightMm: "", priceThb: "", stock: "", madeToOrder: true, finish: "glossy", active: true };

const toDraft = (p: Product): ProductDraft => ({
  name: p.name,
  image: p.image,
  stickerId: p.stickerId,
  widthMm: String(p.widthMm),
  heightMm: String(p.heightMm),
  priceThb: String(p.priceThb),
  stock: p.stock === null ? "" : String(p.stock),
  madeToOrder: p.stock === null,
  finish: p.finish,
  active: p.active,
});

/** Transparent-friendly checkerboard behind sticker art. */
const CHECKER = "bg-[conic-gradient(var(--surface-2)_25%,var(--bg)_0_50%,var(--surface-2)_0_75%,var(--bg)_0)] bg-[length:16px_16px]";

/** Statuses whose units are reserved but not yet gone: cancelling puts them back, shipping doesn't. */
const OPEN_STATUSES = ["awaiting_payment", "slip_submitted", "paid"];

export function ProductsTab({ shop }: { shop: Shop }) {
  const t = useTranslations("seller.products");
  const te = useTranslations("seller.errors");
  const money = useMoney();
  const { data: products, error, retry } = useMarketQuery((s) => s.listProducts(shop.id, { includeInactive: true }), [shop.id]);
  // Open orders already took their units out of `stock`, so the number here is what's still available.
  const { data: orders } = useMarketQuery((s) => s.shopOrders(shop.id), [shop.id]);
  const reserved = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders ?? []) {
      if (!OPEN_STATUSES.includes(o.status)) continue;
      for (const it of o.items) m.set(it.productId, (m.get(it.productId) ?? 0) + it.qty);
    }
    return m;
  }, [orders]);
  // null = closed, "new" = adding, otherwise the product being edited.
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setDeleting(id);
    setDeleteError(null);
    try {
      await (await getStore()).deleteProduct(id);
      setConfirming(null);
    } catch {
      // Keep the confirmation open so the error sits next to the product and Delete can be retried.
      setDeleteError(id);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{products ? t("count", { count: products.length }) : " "}</p>
        <button type="button" onClick={() => setEditing("new")} className={primaryBtn}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          {t("add")}
        </button>
      </div>

      {products === undefined && error ? (
        <LoadError onRetry={retry} />
      ) : products === undefined ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface" aria-busy="true" />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline px-5 py-12 text-center">
          <ImagePlus className="size-6 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-bg">
              <div className={`relative aspect-square ${CHECKER}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / library SVGs */}
                <img src={p.image} alt="" className={`size-full object-contain p-4 ${p.active ? "" : "opacity-40"}`} />
                {!p.active && <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-xs text-bg">{t("hidden")}</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted tabular-nums">
                  {t("size", { w: p.widthMm, h: p.heightMm })} · {p.stock === null ? t("madeToOrderShort") : t("available", { count: p.stock })}
                  {p.stock !== null && !!reserved.get(p.id) && ` · ${t("reservedShort", { count: reserved.get(p.id)! })}`}
                </p>
                <p className="text-sm font-semibold tabular-nums">{money(p.priceThb)}</p>
                {confirming === p.id ? (
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-sm">
                    <span className="w-full text-xs">{t("confirmDelete")}</span>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => {
                        setConfirming(null);
                        setDeleteError(null);
                        requestAnimationFrame(() => document.getElementById(`del-${p.id}`)?.focus());
                      }}
                      className="rounded-full px-3 py-1.5 hover:bg-surface"
                    >
                      {t("keep")}
                    </button>
                    <button
                      type="button"
                      disabled={deleting === p.id}
                      aria-busy={deleting === p.id}
                      onClick={() => void remove(p.id)}
                      className="rounded-full bg-[#c62f35] px-3 py-1.5 font-medium text-white disabled:opacity-50"
                    >
                      {t("delete")}
                    </button>
                    {deleteError === p.id && (
                      <p role="alert" className="w-full text-xs text-[#C62F35]">
                        {te("delete")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-auto flex items-center gap-1 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="mr-auto inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-sm hover:border-ink"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      id={`del-${p.id}`}
                      onClick={() => {
                        setConfirming(p.id);
                        setDeleteError(null);
                      }}
                      aria-label={`${t("delete")} ${p.name}`}
                      title={t("delete")}
                      className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-[#c62f35]"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductDialog
          shop={shop}
          product={editing === "new" ? null : editing}
          reserved={editing === "new" ? 0 : (reserved.get(editing.id) ?? 0)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ProductDialog({ shop, product, reserved, onClose }: { shop: Shop; product: Product | null; reserved: number; onClose: () => void }) {
  const t = useTranslations("seller.products");
  const locale = useLocale() as "th" | "en";
  const te = useTranslations("seller.errors");
  const ref = useRef<HTMLDialogElement>(null);
  const [initial] = useState<ProductDraft>(() => (product ? toDraft(product) : EMPTY));
  const [d, setD] = useState<ProductDraft>(initial);
  // Unsaved changes: Esc, ×, Cancel and closing the tab all ask first instead of dropping them.
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const [discarding, setDiscarding] = useState(false);
  /** Set right before a close we mean (saved, or discard confirmed). */
  const leaving = useRef(false);
  useUnsavedGuard(dirty);
  const [errors, setErrors] = useState<Errors<ProductField>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [source, setSource] = useState<"upload" | "library">(product?.stickerId ? "library" : "upload");
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const err = (k: ProductField) => (errors[k] ? te(errors[k]!) : undefined);
  const w = Number(d.widthMm.replace(",", "."));
  const h = Number(d.heightMm.replace(",", "."));

  const submit = async () => {
    const { errors, data } = validateProduct(d);
    setErrors(errors);
    if (!data) {
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await (await getStore()).saveProduct(shop.id, data, product?.id);
      leaving.current = true;
      ref.current?.close();
    } catch (e) {
      setSaveError(te(e instanceof Error && e.message === "storage-full" ? "storageFull" : "save"));
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (dirty) return setDiscarding(true);
    leaving.current = true;
    ref.current?.close();
  };
  const discard = () => {
    leaving.current = true;
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Esc: ask in the page instead of dropping the draft.
        if (!dirty) return;
        e.preventDefault();
        setDiscarding(true);
      }}
      onClose={() => {
        // Some browsers close on a second Esc even when cancel was prevented: reopen and ask.
        if (dirty && !leaving.current) {
          ref.current?.showModal();
          setDiscarding(true);
          return;
        }
        onClose();
      }}
      aria-labelledby="product-dialog-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-hairline bg-bg p-0 text-ink shadow-soft backdrop:bg-black/40"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-5 p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="product-dialog-title" className="text-xl font-semibold tracking-tight">
            {product ? t("editTitle") : t("addTitle")}
          </h2>
          <button type="button" onClick={requestClose} aria-label={t("close")} className="grid size-9 place-items-center rounded-full hover:bg-surface">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Artwork: own upload or a library sticker */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">{t("artwork")}</legend>
          <div role="radiogroup" className="inline-flex self-start rounded-full bg-surface p-1 text-sm">
            {(["upload", "library"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={source === s}
                onClick={() => setSource(s)}
                className="rounded-full px-3.5 py-1.5 text-muted aria-checked:bg-bg aria-checked:text-ink aria-checked:shadow-soft"
              >
                {t(s === "upload" ? "sourceUpload" : "sourceLibrary")}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className={`grid aspect-square w-full shrink-0 place-items-center overflow-hidden rounded-xl border border-hairline sm:w-40 ${CHECKER}`}>
              {d.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URLs / library SVGs
                <img src={d.image} alt={t("previewAlt")} className="size-full object-contain p-3" />
              ) : (
                <ImagePlus className="size-8 text-muted" strokeWidth={1.25} aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {source === "upload" ? (
                <UploadPicker
                  error={err("image")}
                  onPick={(image) => {
                    setD((x) => ({ ...x, image, stickerId: undefined }));
                    setErrors((e) => ({ ...e, image: undefined }));
                  }}
                />
              ) : (
                <LibraryPicker
                  selected={d.stickerId}
                  error={err("image")}
                  onPick={(def) => {
                    const height = Math.round(((def.widthMm * def.viewBox[1]) / def.viewBox[0]) * 10) / 10;
                    setD((x) => ({
                      ...x,
                      image: stickerThumb(def),
                      stickerId: def.id,
                      name: x.name || def.name[locale],
                      widthMm: String(def.widthMm),
                      heightMm: String(height),
                    }));
                    setErrors((e) => ({ ...e, image: undefined }));
                  }}
                />
              )}
            </div>
          </div>
        </fieldset>

        <Field id="p-name" label={t("name")} error={err("name")}>
          <input
            id="p-name"
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={80}
            className={fieldClass}
            {...ariaFor("p-name", err("name"))}
          />
        </Field>

        <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Ruler className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t("sizeTitle")}
          </p>
          <p className="text-xs text-muted">{t("sizeHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field id="p-w" label={t("width")} error={err("widthMm")}>
              <input
                id="p-w"
                inputMode="decimal"
                value={d.widthMm}
                onChange={(e) => set("widthMm", e.target.value)}
                className={fieldClass}
                {...ariaFor("p-w", err("widthMm"))}
              />
            </Field>
            <Field id="p-h" label={t("height")} error={err("heightMm")}>
              <input
                id="p-h"
                inputMode="decimal"
                value={d.heightMm}
                onChange={(e) => set("heightMm", e.target.value)}
                className={fieldClass}
                {...ariaFor("p-h", err("heightMm"))}
              />
            </Field>
          </div>
          <p className="text-sm tabular-nums" aria-live="polite">
            {w > 0 && h > 0 ? t("trueScale", { w, h, wcm: (w / 10).toFixed(1), hcm: (h / 10).toFixed(1) }) : t("sizeRange")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-price" label={t("price")} hint={t("priceHint")} error={err("priceThb")}>
            <input
              id="p-price"
              inputMode="numeric"
              value={d.priceThb}
              onChange={(e) => set("priceThb", e.target.value)}
              className={fieldClass}
              {...ariaFor("p-price", err("priceThb"))}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            {/* The field is what buyers can still order: units held by open orders are already out of it. */}
            <Field
              id="p-stock"
              label={t("stock")}
              hint={d.madeToOrder || !reserved ? t("stockHint") : t("stockReserved", { count: reserved })}
              error={err("stock")}
            >
              <input
                id="p-stock"
                inputMode="numeric"
                value={d.madeToOrder ? "" : d.stock}
                disabled={d.madeToOrder}
                placeholder={d.madeToOrder ? t("madeToOrderShort") : ""}
                onChange={(e) => set("stock", e.target.value)}
                className={`${fieldClass} disabled:bg-surface disabled:text-muted`}
                {...ariaFor("p-stock", err("stock"))}
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={d.madeToOrder} onChange={(e) => set("madeToOrder", e.target.checked)} className="size-4 accent-[var(--text)]" />
              {t("madeToOrder")}
            </label>
          </div>
        </div>

        <Field id="p-finish" label={t("finish")}>
          <select id="p-finish" value={d.finish} onChange={(e) => set("finish", e.target.value as ProductDraft["finish"])} className={fieldClass}>
            {FINISHES.map((f) => (
              <option key={f} value={f}>
                {t(`finishes.${f}`)}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-4">
          <input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--text)]" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("active")}</span>
            <span className="text-xs text-muted">{t("activeHint")}</span>
          </span>
        </label>

        {saveError && (
          <p role="alert" className="text-sm text-[#C62F35]">
            {saveError}
          </p>
        )}
        {discarding && (
          <div role="alertdialog" aria-labelledby="discard-title" className="flex flex-col gap-3 rounded-xl border border-ink bg-surface p-4">
            <p id="discard-title" className="text-sm font-medium">
              {t("discardTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" autoFocus onClick={() => setDiscarding(false)} className={`${secondaryBtn} h-10 bg-bg`}>
                {t("keepEditing")}
              </button>
              <button type="button" onClick={discard} className="inline-flex h-10 items-center rounded-full bg-[#c62f35] px-4 text-sm font-medium text-white">
                {t("discard")}
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={requestClose} className={secondaryBtn}>
            {t("cancel")}
          </button>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function UploadPicker({ onPick, error }: { onPick: (dataUrl: string) => void; error?: string }) {
  const t = useTranslations("seller.products");
  const te = useTranslations("seller.errors");
  const [bad, setBad] = useState(false);
  return (
    <Field id="p-image" label={t("upload")} hint={t("uploadHint")} error={bad ? te("badImage") : error}>
      <input
        id="p-image"
        type="file"
        accept="image/png,image/webp,image/jpeg"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            setBad(false);
            onPick(await fileToDataUrl(file, 900));
          } catch {
            setBad(true);
          }
        }}
        className="block w-full text-sm file:mr-3 file:rounded-full file:border file:border-hairline file:bg-bg file:px-4 file:py-2 file:text-sm file:font-medium hover:file:border-ink"
        {...ariaFor("p-image", bad || error ? "x" : undefined)}
      />
    </Field>
  );
}

function LibraryPicker({ selected, onPick, error }: { selected?: string; onPick: (def: (typeof VISIBLE_LIBRARY)[number]) => void; error?: string }) {
  const t = useTranslations("seller.products");
  const locale = useLocale() as "th" | "en";
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = s ? VISIBLE_LIBRARY.filter((d) => d.name.en.toLowerCase().includes(s) || d.name.th.includes(s) || d.id.includes(s)) : VISIBLE_LIBRARY;
    return all.slice(0, 24);
  }, [q]);
  return (
    <div className="flex flex-col gap-2">
      <Field id="p-lib" label={t("searchLibrary")} hint={t("libraryHint")} error={error}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <input id="p-lib" type="search" value={q} onChange={(e) => setQ(e.target.value)} className={`${fieldClass} pl-9`} {...ariaFor("p-lib", error)} />
        </div>
      </Field>
      {results.length === 0 ? (
        <p className="text-sm text-muted">{t("noResults")}</p>
      ) : (
        <ul className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
          {results.map((def) => (
            <li key={def.id}>
              <button
                type="button"
                onClick={() => onPick(def)}
                aria-pressed={selected === def.id}
                title={def.name[locale]}
                className="grid aspect-square w-full place-items-center rounded-lg border border-hairline bg-bg p-1.5 hover:border-ink aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-[#D7FF3A]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG thumbs */}
                <img src={stickerThumb(def)} alt={def.name[locale]} loading="lazy" className="size-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
