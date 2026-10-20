"use client";

import { Copy, LogOut, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LidSurface, LogoMark } from "@/components/LidArt";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { createLayout, deleteLayout, duplicateLayout, listLayouts, renameLayout, type SavedLayout } from "@/features/editor/collection";
import { loadAssets } from "@/features/editor/persist";
import { Link, useRouter } from "@/i18n/navigation";
import type { StickerAsset } from "@/lib/layout";
import { signOut, type Session } from "@/lib/session";

/** Real-proportion preview of a saved layout, drawn from the stickers cached on this device. */
function LayoutThumb({ entry, assets }: { entry: SavedLayout; assets: Record<string, StickerAsset> }) {
  const model = getLaptopModel(entry.layout.modelId);
  const g = lidGeometry(model);
  const color = model.colors.find((c) => c.id === entry.layout.colorId)?.hex ?? model.colors[0].hex;
  return (
    <svg viewBox={`0 0 ${g.widthMm} ${g.heightMm}`} className="h-auto w-full" aria-hidden="true">
      <LidSurface widthMm={g.widthMm} heightMm={g.heightMm} radiusMm={g.cornerRadiusMm} color={color} />
      <LogoMark logo={g.logo} lidColor={color} finish={model.logoFinish} />
      {entry.layout.items.map((it) => {
        const a = assets[it.assetId];
        if (!a) return null;
        return (
          <g key={it.id} transform={`translate(${it.xMm} ${it.yMm}) rotate(${it.rotationDeg}) scale(${it.flipX ? -1 : 1} 1)`}>
            <image href={a.src} x={-it.widthMm / 2} y={-it.heightMm / 2} width={it.widthMm} height={it.heightMm} />
          </g>
        );
      })}
    </svg>
  );
}

function relativeTime(iso: string, locale: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "th" ? "th" : "en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
  ];
  let v = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
    v /= size;
  }
  return rtf.format(Math.round(v), "year");
}

export function CollectionView({ session }: { session: Session }) {
  const t = useTranslations("collection");
  const ta = useTranslations("auth");
  const ts = useTranslations("seller");
  const locale = useLocale();
  const router = useRouter();
  // Rendered only after the sign-in gate (client side), so localStorage is available here.
  const [entries, setEntries] = useState<SavedLayout[]>(() => listLayouts());
  const [assets, setAssets] = useState<Record<string, StickerAsset>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Escape cancels a rename; the blur that follows unmounting the input must not save it.
  const cancelRename = useRef(false);

  const refresh = () => setEntries(listLayouts());
  useEffect(() => {
    loadAssets().then(setAssets);
    // The editor in another tab autosaves here; keep the list current.
    const onStorage = (e: StorageEvent) => e.key?.startsWith("peelplan.collection") && setEntries(listLayouts());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const endRename = (id: string, value: string | null) => {
    if (value !== null) renameLayout(id, value);
    setRenaming(null);
    refresh();
    // Put focus back on the pencil so keyboard users keep their place.
    requestAnimationFrame(() => document.getElementById(`rename-${id}`)?.focus());
  };

  const { user, profile, demo } = session;
  const name = profile?.displayName || user.name;
  const shop = profile?.isShop ? profile.shop : undefined;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 pt-6 pb-20 sm:px-8">
      {/* Profile */}
      <section aria-label={t("profile")} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-accent text-2xl font-semibold text-accent-ink" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{name}</h1>
            <p className="text-sm break-words text-muted">
              {user.email} · {demo ? t("testAccount") : t("buyer")}
            </p>
            {shop && (
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <Store className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {ts("collectionShop", { name: shop.name })}
                <Link href="/seller" className="font-medium underline underline-offset-4 hover:text-muted">
                  {ts("manageShop")}
                </Link>
              </p>
            )}
          </div>
        </div>
        {/* Sign-out lives here now that the site header has no account avatar. */}
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="inline-flex items-center gap-2 self-start rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-ink hover:text-ink sm:self-center"
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {ta("signOut")}
        </button>
      </section>

      {/* Layouts */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("subtitle")} · {t("layoutsCount", { count: entries.length })}
            </p>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-[#30a46c]" aria-hidden="true" />
            {t("autosave")}
          </p>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <button
              type="button"
              onClick={() => router.push(`/editor?layout=${createLayout().id}`)}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-hairline text-muted transition-colors hover:border-ink hover:text-ink"
            >
              <Plus className="size-7" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-medium">{t("newLayout")}</span>
            </button>
          </li>
          {entries.map((e) => {
            const model = getLaptopModel(e.layout.modelId);
            const title = e.name || t("untitled");
            return (
              <li
                key={e.id}
                className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-bg transition-shadow hover:shadow-soft"
              >
                <Link href={`/editor?layout=${e.id}`} className="block bg-surface p-5" aria-label={`${t("open")} ${title}`}>
                  <LayoutThumb entry={e} assets={assets} />
                </Link>
                <div className="flex flex-col gap-2 p-4">
                  {renaming === e.id ? (
                    <input
                      autoFocus
                      aria-label={t("nameLabel")}
                      defaultValue={e.name}
                      maxLength={60}
                      onFocus={() => (cancelRename.current = false)}
                      onBlur={(ev) => endRename(e.id, cancelRename.current ? null : ev.currentTarget.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") ev.currentTarget.blur();
                        if (ev.key === "Escape") {
                          cancelRename.current = true;
                          ev.currentTarget.blur();
                        }
                      }}
                      className="h-9 rounded-lg border border-ink bg-bg px-2.5 text-sm outline-none"
                    />
                  ) : (
                    <p className="truncate font-medium">{title}</p>
                  )}
                  <p className="text-xs text-muted">
                    {model.name} · {t("stickers", { count: e.layout.items.length })} · {t("edited", { when: relativeTime(e.updatedAt, locale) })}
                  </p>
                  {confirming === e.id ? (
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <span className="mr-auto">{t("confirmDelete")}</span>
                      {/* The safe choice takes focus, so Enter right after "Delete" doesn't destroy anything. */}
                      <button
                        type="button"
                        autoFocus
                        onClick={() => {
                          setConfirming(null);
                          requestAnimationFrame(() => document.getElementById(`delete-${e.id}`)?.focus());
                        }}
                        className="rounded-full px-3 py-1.5 hover:bg-surface"
                      >
                        {t("confirmNo")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteLayout(e.id);
                          setConfirming(null);
                          refresh();
                        }}
                        className="rounded-full bg-[#c62f35] px-3 py-1.5 font-medium text-white"
                      >
                        {t("confirmYes")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1">
                      <Link href={`/editor?layout=${e.id}`} className="mr-auto rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink">
                        {t("open")}
                      </Link>
                      <button
                        type="button"
                        id={`rename-${e.id}`}
                        onClick={() => setRenaming(e.id)}
                        aria-label={t("rename")}
                        title={t("rename")}
                        className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
                      >
                        <Pencil className="size-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          duplicateLayout(e.id, t("copySuffix"));
                          refresh();
                        }}
                        aria-label={t("duplicate")}
                        title={t("duplicate")}
                        className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
                      >
                        <Copy className="size-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        id={`delete-${e.id}`}
                        onClick={() => setConfirming(e.id)}
                        aria-label={t("delete")}
                        title={t("delete")}
                        className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-[#c62f35]"
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {entries.length === 0 && (
          <p className="text-sm text-muted">
            {t("emptyTitle")}: {t("emptyBody")}
          </p>
        )}
      </section>
    </div>
  );
}
