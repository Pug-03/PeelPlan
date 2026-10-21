"use client";

import { ImagePlus, Search, SearchX, Store, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo, useDeferredValue, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { svgToPngDataUrl } from "@/lib/image/browser";
import type { StickerAsset } from "@/lib/layout";
import { ART_VERSION, VISIBLE_LIBRARY, stickerThumb, svgDataUrl, type LibrarySticker, type StickerCategory } from "@/stickers/library";
import { GROUP_LABELS, STICKER_GROUPS, buildIndex, groupCounts, searchStickers, type GroupFilter } from "@/stickers/search";
import { Link } from "@/i18n/navigation";
import { getCurrentId, isAssetUsedElsewhere } from "../collection";
import { deleteAsset, saveAsset } from "../persist";
import { useEditor } from "../store";
import { Segmented } from "./controls";

/** Library stickers are rasterised at this density so the PDF can embed them. */
const LIBRARY_PX_PER_MM = 12;

export async function ensureLibraryAsset(def: LibrarySticker): Promise<StickerAsset> {
  const id = `lib:${def.id}`;
  const existing = useEditor.getState().assets[id];
  // Re-cache when the artwork changed: a new SVG revision, or a raster re-cut at another resolution.
  if (existing && (def.svg ? existing.rev === ART_VERSION : existing.pxWidth === def.viewBox[0])) return existing;
  // SVGs are rasterised at a print-friendly density; raster stickers keep their own pixels.
  const png = def.svg ? await svgToPngDataUrl(svgDataUrl(def.svg), def.widthMm * LIBRARY_PX_PER_MM) : await svgToPngDataUrl(def.src!);
  const asset: StickerAsset = {
    id,
    src: png.src,
    pxWidth: png.width,
    pxHeight: png.height,
    defaultWidthMm: def.widthMm,
    source: "library",
    rev: def.svg ? ART_VERSION : undefined,
  };
  useEditor.getState().addAsset(asset);
  void saveAsset(asset);
  return asset;
}

/** Built once: the library is static for the session. */
const INDEX = buildIndex(VISIBLE_LIBRARY);
const COUNTS = groupCounts(INDEX);
const CHIP_GROUPS = STICKER_GROUPS.filter((g) => COUNTS[g] > 0);

/** Thumbnails are data URLs of the SVG; encode each once rather than on every filter change. */
const thumbs = new Map<string, string>();
const thumbOf = (s: LibrarySticker) => thumbs.get(s.id) ?? (thumbs.set(s.id, stickerThumb(s)), thumbs.get(s.id)!);

const LibraryTile = memo(function LibraryTile({ sticker: s, locale, onAddFailed }: { sticker: LibrarySticker; locale: "th" | "en"; onAddFailed: () => void }) {
  const t = useTranslations("editor");
  const addItem = useEditor((st) => st.addItem);
  return (
    <li>
      <button
        type="button"
        aria-label={t("add", { name: s.name[locale] })}
        onClick={() => void ensureLibraryAsset(s).then((asset) => addItem(asset, s.name[locale]), onAddFailed)}
        className="group flex w-full flex-col items-center gap-1.5 rounded-xl bg-surface p-3 transition-colors hover:bg-surface-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbOf(s)}
          alt=""
          decoding="async"
          className="aspect-square w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:-rotate-3"
        />
        <span className="w-full truncate text-center text-xs">{s.name[locale]}</span>
        <span className="text-[0.7rem] tabular-nums text-muted">{s.widthMm} mm</span>
      </button>
    </li>
  );
});

function LibraryGrid({ stickers, locale, onAddFailed }: { stickers: LibrarySticker[]; locale: "th" | "en"; onAddFailed: () => void }) {
  return (
    <ul className="grid grid-cols-3 gap-2 lg:grid-cols-2">
      {stickers.map((s) => (
        <LibraryTile key={s.id} sticker={s} locale={locale} onAddFailed={onAddFailed} />
      ))}
    </ul>
  );
}

export function StickerPanel({ onUpload, onAddFailed }: { onUpload: (f: File) => void; onAddFailed: () => void }) {
  const t = useTranslations("editor");
  const locale = useLocale() as "th" | "en";
  const [tab, setTab] = useState<"mine" | "library" | "shop">("library");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  // Typing stays snappy while the grid catches up.
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => searchStickers(INDEX, deferredQuery, group), [deferredQuery, group]);
  const filtering = group !== "all" || deferredQuery.trim() !== "";
  const resetFilters = () => {
    setQuery("");
    setGroup("all");
  };
  const { assets, addItem, removeAsset } = useEditor(useShallow((s) => ({ assets: s.assets, addItem: s.addItem, removeAsset: s.removeAsset })));
  const fileRef = useRef<HTMLInputElement>(null);
  const uploads = Object.values(assets).filter((a) => a.source === "upload");

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Segmented
          label={t("sidebar")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "library", label: t("tabs.library") },
            { value: "mine", label: t("tabs.mine") },
            { value: "shop", label: t("tabs.shop") },
          ]}
        />
        {tab === "library" && (
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-hairline bg-bg px-3 focus-within:border-ink">
              <Search className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">{t("search")}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && query && (e.preventDefault(), setQuery(""))}
                placeholder={t("searchPlaceholder")}
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("clearSearch")}
                  className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              )}
            </label>
            {/* Narrow panel: chips scroll sideways rather than wrap. */}
            <div
              role="group"
              aria-label={t("groups")}
              className="-mx-3 flex gap-1.5 overflow-x-auto overscroll-x-contain px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {(["all", ...CHIP_GROUPS] as GroupFilter[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={(e) => {
                    setGroup(g);
                    e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                  }}
                  className="h-8 shrink-0 rounded-full border border-hairline px-3 text-xs whitespace-nowrap text-muted transition-colors hover:border-ink hover:text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
                >
                  {g === "all" ? t("groupAll") : GROUP_LABELS[g][locale]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Phones: the floating bottom bar overlaps this sheet, so leave room to scroll the last rows above it. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 max-lg:pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        {tab === "library" && (
          <div className="flex flex-col gap-3">
            <p aria-live="polite" className="px-1 text-xs text-muted">
              {t("resultCount", { count: results.length })}
            </p>
            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-surface px-4 py-8 text-center">
                <SearchX className="size-6 text-muted" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-sm font-medium">{t("noResults", { query: deferredQuery.trim() })}</p>
                <p className="text-xs leading-relaxed text-muted">{t("noResultsHint")}</p>
                <button type="button" onClick={resetFilters} className="mt-1 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-bg hover:opacity-90">
                  {t("showAll")}
                </button>
              </div>
            ) : filtering ? (
              <LibraryGrid stickers={results} locale={locale} onAddFailed={onAddFailed} />
            ) : (
              <div className="flex flex-col gap-5">
                {(["fun", "coding", "character"] as StickerCategory[]).map((cat) => {
                  const list = VISIBLE_LIBRARY.filter((s) => (s.category ?? "fun") === cat);
                  if (!list.length) return null;
                  return (
                    <section key={cat} aria-label={t(`categories.${cat}`)}>
                      <h3 className="mb-2 px-1 text-xs text-muted">{t(`categories.${cat}`)}</h3>
                      <LibraryGrid stickers={list} locale={locale} onAddFailed={onAddFailed} />
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "mine" && (
          <div className="flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline px-4 py-6 text-center transition-colors hover:border-ink hover:bg-surface"
            >
              <ImagePlus className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm font-medium">{t("upload")}</span>
              <span className="text-xs text-muted">{t("uploadHint")}</span>
            </button>
            {uploads.length === 0 ? (
              <p className="px-1 text-sm text-muted">{t("noUploads")}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 lg:grid-cols-2">
                {uploads.map((a) => (
                  <li key={a.id} className="group relative">
                    <button
                      type="button"
                      aria-label={t("add", { name: `${Math.round(a.defaultWidthMm)} mm` })}
                      onClick={() => addItem(a, `${Math.round(a.defaultWidthMm)} mm`)}
                      className="flex w-full flex-col items-center gap-1.5 rounded-xl bg-surface p-3 hover:bg-surface-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.src} alt="" className="aspect-square w-full object-contain" />
                      <span className="text-[0.7rem] tabular-nums text-muted">{Math.round(a.defaultWidthMm)} mm</span>
                    </button>
                    <button
                      type="button"
                      aria-label={t("deleteAsset")}
                      onClick={() => {
                        removeAsset(a.id);
                        // Uploads are shared by every layout on this device; keep the file while
                        // another saved layout still places it, so that layout doesn't lose stickers.
                        if (!isAssetUsedElsewhere(a.id, getCurrentId())) void deleteAsset(a.id);
                      }}
                      className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-bg/90 text-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink [@media(hover:none)]:opacity-100"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "shop" && (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-4">
            <Store className="size-6" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted">{t("shopHint")}</p>
            <Link href="/shops" className="rounded-full border border-ink px-4 py-2 text-sm font-medium transition-colors hover:bg-ink hover:text-bg">
              {t("shopLink")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
