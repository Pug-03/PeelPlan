"use client";

import { ImagePlus, Store, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { svgToPngDataUrl } from "@/lib/image/browser";
import type { StickerAsset } from "@/lib/layout";
import { ART_VERSION, VISIBLE_LIBRARY, stickerThumb, svgDataUrl, type LibrarySticker, type StickerCategory } from "@/stickers/library";
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

export function StickerPanel({ onUpload }: { onUpload: (f: File) => void }) {
  const t = useTranslations("editor");
  const locale = useLocale() as "th" | "en";
  const [tab, setTab] = useState<"mine" | "library" | "shop">("library");
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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {tab === "library" && (
          <div className="flex flex-col gap-5">
            {(["fun", "coding", "character"] as StickerCategory[]).map((cat) => {
              const group = VISIBLE_LIBRARY.filter((s) => (s.category ?? "fun") === cat);
              if (!group.length) return null;
              return (
                <section key={cat} aria-label={t(`categories.${cat}`)}>
                  <h3 className="mb-2 px-1 text-xs text-muted">{t(`categories.${cat}`)}</h3>
                  <ul className="grid grid-cols-3 gap-2 lg:grid-cols-2">
                    {group.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-label={t("add", { name: s.name[locale] })}
                          onClick={async () => addItem(await ensureLibraryAsset(s), s.name[locale])}
                          className="group flex w-full flex-col items-center gap-1.5 rounded-xl bg-surface p-3 transition-colors hover:bg-surface-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={stickerThumb(s)}
                            alt=""
                            className="aspect-square w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:-rotate-3"
                          />
                          <span className="w-full truncate text-center text-xs">{s.name[locale]}</span>
                          <span className="text-[0.7rem] tabular-nums text-muted">{s.widthMm} mm</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
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
            <p className="text-sm leading-relaxed text-muted">{t("shopSoon")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
