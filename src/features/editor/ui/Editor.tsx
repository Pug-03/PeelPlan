"use client";

import { Download, ImageDown, LayoutGrid, Link2, Maximize2, Minus, Plus, Redo2, Ruler, ScanLine, TriangleAlert, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { LAPTOP_MODELS, getLaptopModel, lidGeometry } from "@/config/laptops";
import { Link } from "@/i18n/navigation";
import { layoutWarnings } from "@/lib/warnings";
import { ART_VERSION, VISIBLE_LIBRARY } from "@/stickers/library";
import { AccountMenu } from "@/components/AccountMenu";
import { LocaleSwitch, ThemeToggle } from "@/components/SiteHeader";
import { Wordmark } from "@/components/Wordmark";
import { createLayout, resolveEditorLayout, saveLayoutEntry } from "../collection";
import { decodeShare, encodeShare, loadAssets, loadCalibration, saveAsset } from "../persist";
import { currentLayout, useEditor } from "../store";
import { CalibrateDialog } from "./CalibrateDialog";
import { Button, IconButton, Toggle } from "./controls";
import { ExportDialog } from "./ExportDialog";
import { Inspector } from "./Inspector";
import { LidStage } from "./LidStage";
import { saveShareImage } from "./shareCard";
import { StickerPanel, ensureLibraryAsset } from "./StickerPanel";
import { UploadDialog } from "./UploadDialog";

/** Collection entry the editor is working on; autosave writes here. */
let activeLayoutId: string | null = null;

/** Loads the layout to edit: ?layout=<id> from the collection, a share link (saved as a new entry), or the last one used. */
function useHydrate(onSharedOpened: () => void) {
  const hydrate = useEditor((s) => s.hydrate);
  const sharedOpened = useEffectEvent(onSharedOpened);
  useEffect(() => {
    let cancelled = false;
    // The store outlives this page: until the new layout is loaded, hide the previous one and stop
    // autosave from writing into either entry.
    activeLayoutId = null;
    useEditor.setState({ hydrated: false });
    (async () => {
      const [assets, hash] = [await loadAssets(), window.location.hash.match(/#s=(.+)$/)?.[1]];
      const shared = hash ? await decodeShare(hash) : null;
      if (cancelled) return;
      if (shared) {
        // Rebuild library stickers referenced by the link before showing it; uploads are device-only.
        for (const id of new Set(shared.items.map((i) => i.assetId))) {
          const def = id.startsWith("lib:") ? VISIBLE_LIBRARY.find((l) => `lib:${l.id}` === id) : undefined;
          if (def) await ensureLibraryAsset(def).catch(() => undefined);
        }
        if (cancelled) return;
        sharedOpened();
      }
      // Refresh cached library rasters that are out of date before showing the layout.
      for (const a of Object.values(assets)) {
        const def = a.source === "library" ? VISIBLE_LIBRARY.find((l) => `lib:${l.id}` === a.id) : undefined;
        if (def && (def.svg ? a.rev !== ART_VERSION : a.pxWidth !== def.viewBox[0])) assets[a.id] = await ensureLibraryAsset(def).catch(() => a);
      }
      if (cancelled) return;
      const known = { ...assets, ...useEditor.getState().assets };
      const requested = new URLSearchParams(window.location.search).get("layout");
      const entry = shared ? createLayout(shared) : resolveEditorLayout(requested);
      activeLayoutId = entry.id;
      // Keep the address pointing at this layout (drops a consumed share hash).
      const url = new URL(window.location.href);
      url.hash = "";
      url.searchParams.set("layout", entry.id);
      history.replaceState(null, "", url.pathname + url.search);
      const layout = entry.layout;
      hydrate(layout && { ...layout, items: layout.items.filter((i) => known[i.assetId]) }, assets, loadCalibration());
    })().catch(() => !cancelled && hydrate(null, {}, loadCalibration()));
    return () => {
      cancelled = true;
    };
  }, [hydrate]);
}

function useAutosave() {
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        // Skip the hydrate itself: just opening a layout must not bump its "edited" time.
        if (!s.hydrated || !prev.hydrated) return;
        if (s.items !== prev.items || s.modelId !== prev.modelId || s.colorId !== prev.colorId || s.keepLogoClear !== prev.keepLogoClear)
          if (activeLayoutId) saveLayoutEntry(activeLayoutId, currentLayout(s));
      }),
    [],
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], dialog")) return;
      const s = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && key === "d") {
        e.preventDefault();
        s.duplicateSelected();
      } else if (mod && key === "a") {
        e.preventDefault();
        s.select(s.items.map((i) => i.id));
      } else if (!mod && (e.key === "Delete" || e.key === "Backspace")) {
        if (s.selectedIds.length) {
          e.preventDefault();
          s.removeSelected();
        }
      } else if (e.key === "Escape") {
        s.select([]);
      } else if (e.key.startsWith("Arrow") && s.selectedIds.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        // A held key nudges repeatedly but leaves one undo step.
        s.updateItems(s.selectedIds, (it) => (it.locked ? {} : { xMm: it.xMm + dx, yMm: it.yMm + dy }), { history: !e.repeat });
      } else if (!mod && e.key === "]") s.reorderSelected(e.shiftKey ? "front" : "forward");
      else if (!mod && e.key === "[") s.reorderSelected(e.shiftKey ? "back" : "backward");
      else if (!mod && key === "l" && s.selectedIds.length) {
        const sel = s.items.filter((i) => s.selectedIds.includes(i.id));
        const lock = !sel.every((i) => i.locked);
        s.updateItems(s.selectedIds, () => ({ locked: lock }));
      } else if (!mod && key === "h" && s.selectedIds.length) s.updateItems(s.selectedIds, (it) => (it.locked ? {} : { flipX: !it.flipX }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function Editor() {
  const t = useTranslations("editor");
  const locale = useLocale() as "th" | "en";
  useAutosave();
  useShortcuts();

  // Everything except selection: selection changes shouldn't re-render the whole shell.
  const s = useEditor(
    useShallow((st) => ({
      modelId: st.modelId,
      colorId: st.colorId,
      keepLogoClear: st.keepLogoClear,
      items: st.items,
      assets: st.assets,
      canUndo: st.past.length > 0,
      canRedo: st.future.length > 0,
      calibratedPxPerMm: st.calibratedPxPerMm,
      viewMode: st.viewMode,
      zoom: st.zoom,
      hydrated: st.hydrated,
      undo: st.undo,
      redo: st.redo,
      setModel: st.setModel,
      setColor: st.setColor,
      setKeepLogoClear: st.setKeepLogoClear,
      setViewMode: st.setViewMode,
      setZoom: st.setZoom,
      addAsset: st.addAsset,
      addItem: st.addItem,
    })),
  );
  const model = getLaptopModel(s.modelId);
  const lid = useMemo(() => lidGeometry(model), [model]);
  const warnings = useMemo(() => layoutWarnings(s.items, lid, s.keepLogoClear), [s.items, lid, s.keepLogoClear]);
  const [calOpen, setCalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<"stickers" | "edit" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sharedNotice, setSharedNotice] = useState(false);
  useHydrate(() => setSharedNotice(true));

  // "Try on my laptop" from a shop page arrives as ?add=<sticker id>: drop it on the lid at real size.
  useEffect(() => {
    if (!s.hydrated) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("add");
    if (!id) return;
    url.searchParams.delete("add");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    const def = VISIBLE_LIBRARY.find((l) => l.id === id);
    if (def) void ensureLibraryAsset(def).then((asset) => useEditor.getState().addItem(asset, def.name[locale]));
  }, [s.hydrated, locale]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const isActual = s.viewMode === "actual" && !!s.calibratedPxPerMm && Math.abs(s.zoom - 1) < 1e-6;
  const share = async () => {
    const token = await encodeShare(currentLayout(s));
    const url = `${window.location.origin}${window.location.pathname}#s=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      const hasUploads = s.items.some((i) => s.assets[i.assetId]?.source === "upload");
      setToast(hasUploads ? `${t("shared")}. ${t("shareUploadsNote")}` : t("shared"));
    } catch {
      window.prompt(t("share"), url);
    }
  };

  const warningLines = [
    warnings.overlapping.size ? t("overlapWarning", { count: warnings.overlapping.size }) : null,
    warnings.onLogo.size ? t("logoWarning") : null,
    warnings.nearEdge.size ? t("edgeWarning", { count: warnings.nearEdge.size }) : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex h-dvh flex-col bg-surface" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-hairline bg-bg px-2 sm:gap-2 sm:px-3">
        <Link href="/" className="mr-1 rounded-lg px-1" aria-label="PeelPlan">
          <Wordmark className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>
        <Link
          href="/collection"
          title={t("myCollection")}
          aria-label={t("myCollection")}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        >
          <LayoutGrid className="size-4" strokeWidth={1.75} />
        </Link>
        <label className="sr-only" htmlFor="model">
          {t("model")}
        </label>
        <select
          id="model"
          value={s.modelId}
          onChange={(e) => s.setModel(e.target.value)}
          className="h-9 max-w-[9.5rem] min-w-0 rounded-lg border border-hairline bg-bg px-2 text-sm sm:max-w-none"
        >
          {LAPTOP_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.generation})
            </option>
          ))}
        </select>
        <div role="radiogroup" aria-label={t("lidColor")} className="hidden items-center gap-1 md:flex">
          {model.colors.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={s.colorId === c.id}
              aria-label={c.name[locale]}
              title={c.name[locale]}
              onClick={() => s.setColor(c.id)}
              className="size-6 rounded-full border border-black/10 ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-ink"
              style={{ background: c.hex }}
            />
          ))}
        </div>

        <div className="mx-auto" />

        <div className="hidden items-center sm:flex">
          <IconButton label={t("undo")} onClick={s.undo} disabled={!s.canUndo}>
            <Undo2 className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton label={t("redo")} onClick={s.redo} disabled={!s.canRedo}>
            <Redo2 className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
        <span className="hidden md:contents">
          <Button onClick={() => setCalOpen(true)} variant={s.calibratedPxPerMm ? "ghost" : "secondary"}>
            <Ruler className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {s.calibratedPxPerMm ? t("recalibrate") : t("calibrate")}
          </Button>
        </span>
        <IconButton label={t("share")} onClick={share} className="hidden sm:grid">
          <Link2 className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton
          label={t("saveImage")}
          onClick={() => void saveShareImage(model, s.colorId).then((ok) => !ok && setToast(t("saveImageFailed")))}
          className="hidden sm:grid"
        >
          <ImageDown className="size-4" strokeWidth={1.75} />
        </IconButton>
        <Button variant="dark" onClick={() => setExportOpen(true)}>
          <Download className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">{t("export")}</span>
        </Button>
        <div className="hidden lg:flex">
          <LocaleSwitch />
          <ThemeToggle />
        </div>
        <AccountMenu />
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Left panel */}
        <aside
          aria-label={t("sidebar")}
          className={`absolute inset-x-0 bottom-0 z-30 h-[55dvh] rounded-t-[1.25rem] border-t border-hairline bg-bg shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.2)] transition-transform duration-300 ease-[var(--ease-out-soft)] lg:static lg:z-auto lg:h-auto lg:w-72 lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-r lg:shadow-none ${sheet === "stickers" ? "translate-y-0" : "translate-y-full"}`}
        >
          {s.hydrated && (
            <StickerPanel
              onUpload={(f) => {
                setUploadFile(f);
                setSheet(null);
              }}
            />
          )}
        </aside>

        {/* Canvas */}
        <main className="relative min-w-0 flex-1" aria-label={t("canvasLabel", { w: lid.widthMm, h: lid.heightMm, count: s.items.length })}>
          {s.hydrated && <LidStage warnings={warnings} />}

          {/* Scale badge + zoom */}
          <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (isActual ? s.setViewMode("fit") : s.calibratedPxPerMm ? s.setViewMode("actual") : setCalOpen(true))}
              className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-soft ${isActual ? "bg-ink text-bg" : "bg-bg text-ink"}`}
              title={isActual ? t("fit") : s.calibratedPxPerMm ? t("zoomedHint") : t("notActualHint")}
            >
              {isActual ? (
                <ScanLine className="size-3.5" strokeWidth={2} aria-hidden="true" />
              ) : (
                <TriangleAlert className="size-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
              )}
              {isActual ? t("actualSize") : t("notActual")}
              {!isActual && <span className="font-normal text-muted">· {s.calibratedPxPerMm ? t("actualSize") : t("calibrate")}</span>}
            </button>
          </div>
          <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl bg-bg p-1 shadow-soft max-lg:bottom-20">
            <IconButton label={t("zoomOut")} onClick={() => s.setZoom(s.zoom / 1.25)}>
              <Minus className="size-4" strokeWidth={1.75} />
            </IconButton>
            <span className="w-12 text-center text-xs tabular-nums">{Math.round(s.zoom * 100)}%</span>
            <IconButton label={t("zoomIn")} onClick={() => s.setZoom(s.zoom * 1.25)}>
              <Plus className="size-4" strokeWidth={1.75} />
            </IconButton>
            <IconButton label={t("fit")} onClick={() => s.setZoom(1)}>
              <Maximize2 className="size-4" strokeWidth={1.75} />
            </IconButton>
          </div>

          {warningLines.length > 0 && (
            <div
              role="status"
              className="absolute bottom-3 left-3 flex max-w-[calc(100%-15rem)] flex-col gap-1 rounded-xl bg-bg px-3 py-2 text-xs shadow-soft max-lg:top-14 max-lg:bottom-auto max-lg:max-w-[calc(100%-1.5rem)]"
            >
              {warningLines.map((w) => (
                <span key={w} className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#E5484D]" aria-hidden="true" />
                  {w}
                </span>
              ))}
            </div>
          )}

          {sharedNotice && (
            <div
              role="status"
              className="toast-in absolute top-3 left-1/2 z-10 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-xs text-bg shadow-soft"
            >
              <span>{t("sharedOpened")}</span>
              <Link href="/collection" className="rounded-full bg-bg px-3 py-1 font-medium text-ink">
                {t("myCollection")}
              </Link>
              <button type="button" onClick={() => setSharedNotice(false)} aria-label={t("dismiss")} className="px-1.5 opacity-70 hover:opacity-100">
                ×
              </button>
            </div>
          )}
          {toast && (
            <div
              role="status"
              className="toast-in absolute top-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-center text-xs text-bg shadow-soft"
            >
              {toast}
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside
          aria-label={t("inspector")}
          className={`absolute inset-x-0 bottom-0 z-30 h-[55dvh] rounded-t-[1.25rem] border-t border-hairline bg-bg shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.2)] transition-transform duration-300 ease-[var(--ease-out-soft)] lg:static lg:z-auto lg:h-auto lg:w-80 lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none ${sheet === "edit" ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="flex flex-col gap-3 border-b border-hairline p-4">
            {/* Phones have no room for swatches in the top bar. */}
            <div role="radiogroup" aria-label={t("lidColor")} className="flex items-center gap-2 md:hidden">
              <span className="mr-auto text-sm">{t("lidColor")}</span>
              {model.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={s.colorId === c.id}
                  aria-label={c.name[locale]}
                  onClick={() => s.setColor(c.id)}
                  className="size-7 rounded-full border border-black/10 ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-ink"
                  style={{ background: c.hex }}
                />
              ))}
            </div>
            <Toggle checked={s.keepLogoClear} onChange={s.setKeepLogoClear} label={t("logoClear")} />
          </div>
          <Inspector warnings={warnings} />
          <details className="border-t border-hairline px-4 py-3 text-xs text-muted max-lg:hidden">
            <summary className="cursor-pointer">{t("shortcuts")}</summary>
            <p className="mt-2 leading-relaxed">{t("shortcutList")}</p>
          </details>
        </aside>

        {/* Phone bottom bar */}
        <nav
          className="absolute inset-x-3 bottom-3 z-40 flex items-center gap-1 rounded-2xl border border-hairline bg-bg p-1.5 shadow-soft lg:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <Button variant={sheet === "stickers" ? "dark" : "ghost"} className="flex-1" onClick={() => setSheet(sheet === "stickers" ? null : "stickers")}>
            {t("sidebar")}
          </Button>
          <Button variant={sheet === "edit" ? "dark" : "ghost"} className="flex-1" onClick={() => setSheet(sheet === "edit" ? null : "edit")}>
            {t("inspector")}
          </Button>
          <IconButton label={t("undo")} onClick={s.undo} disabled={!s.canUndo}>
            <Undo2 className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton label={t("redo")} onClick={s.redo} disabled={!s.canRedo}>
            <Redo2 className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton label={t("calibrate")} onClick={() => setCalOpen(true)}>
            <Ruler className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton label={t("share")} onClick={share}>
            <Link2 className="size-4" strokeWidth={1.75} />
          </IconButton>
        </nav>
      </div>

      <CalibrateDialog open={calOpen} onClose={() => setCalOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      {uploadFile && (
        <UploadDialog
          key={`${uploadFile.name}-${uploadFile.lastModified}-${uploadFile.size}`}
          file={uploadFile}
          onClose={() => setUploadFile(null)}
          onDone={(asset, label) => {
            s.addAsset(asset);
            void saveAsset(asset).then((ok) => !ok && setToast(t("storageFull")));
            s.addItem(asset, label);
            setUploadFile(null);
          }}
        />
      )}
    </div>
  );
}
