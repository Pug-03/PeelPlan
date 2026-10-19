"use client";

import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, FlipHorizontal2, Lock, LockOpen, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Finish } from "@/lib/layout";
import { roundMm } from "@/lib/scale";
import type { LayoutWarnings } from "@/lib/warnings";
import { useEditor, useLiveReadout } from "../store";
import { IconButton, NumberField, Segmented } from "./controls";

export function Inspector({ warnings }: { warnings: LayoutWarnings }) {
  const live = useLiveReadout((s) => s.live);
  const t = useTranslations("editor");
  const labelDirty = useRef(false);
  const { checkpoint, items, selectedIds, updateItems, removeSelected, duplicateSelected, reorderSelected, select } = useEditor(
    useShallow((s) => ({
      checkpoint: s.checkpoint,
      items: s.items,
      selectedIds: s.selectedIds,
      updateItems: s.updateItems,
      removeSelected: s.removeSelected,
      duplicateSelected: s.duplicateSelected,
      reorderSelected: s.reorderSelected,
      select: s.select,
    })),
  );
  const selected = items.filter((i) => selectedIds.includes(i.id));
  const one = selected.length === 1 ? selected[0] : null;
  const ids = selected.map((s) => s.id);
  const allLocked = selected.length > 0 && selected.every((s) => s.locked);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!selected.length && <p className="text-sm leading-relaxed text-muted">{t("nothingSelected")}</p>}

        {selected.length > 0 && (
          <div className="flex flex-col gap-5">
            {one ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">{t("label")}</span>
                <input
                  value={one.label}
                  // One undo step per edit session: checkpoint on the first keystroke after focus.
                  onFocus={() => (labelDirty.current = false)}
                  onChange={(e) => {
                    if (!labelDirty.current) {
                      checkpoint();
                      labelDirty.current = true;
                    }
                    updateItems([one.id], () => ({ label: e.target.value }), { history: false });
                  }}
                  className="h-10 rounded-lg border border-hairline bg-bg px-3 text-sm outline-none focus:border-ink"
                />
              </label>
            ) : (
              <p className="text-sm font-medium">{t("multiSelected", { count: selected.length })}</p>
            )}

            {one && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label={t("width")}
                    value={live?.w ?? one.widthMm}
                    min={5}
                    max={400}
                    disabled={one.locked}
                    onCommit={(w) => updateItems([one.id], (it) => ({ widthMm: w, heightMm: (w * it.heightMm) / it.widthMm }))}
                  />
                  <NumberField
                    label={t("height")}
                    value={live?.h ?? one.heightMm}
                    min={5}
                    max={400}
                    disabled={one.locked}
                    onCommit={(h) => updateItems([one.id], (it) => ({ heightMm: h, widthMm: (h * it.widthMm) / it.heightMm }))}
                  />
                  <NumberField label={t("x")} value={one.xMm} disabled={one.locked} onCommit={(x) => updateItems([one.id], () => ({ xMm: x }))} />
                  <NumberField label={t("y")} value={one.yMm} disabled={one.locked} onCommit={(y) => updateItems([one.id], () => ({ yMm: y }))} />
                  <NumberField
                    label={t("rotation")}
                    unit="°"
                    step={1}
                    value={live?.r ?? one.rotationDeg}
                    disabled={one.locked}
                    onCommit={(r) => updateItems([one.id], () => ({ rotationDeg: ((r % 360) + 360) % 360 }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">{t("finish")}</span>
                  <Segmented<Finish>
                    label={t("finish")}
                    value={one.finish}
                    onChange={(f) => updateItems([one.id], () => ({ finish: f }))}
                    options={[
                      { value: "glossy", label: t("finishes.glossy") },
                      { value: "matte", label: t("finishes.matte") },
                      { value: "transparent", label: t("finishes.transparent") },
                    ]}
                  />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
              <IconButton label={allLocked ? t("unlock") : t("lock")} active={allLocked} onClick={() => updateItems(ids, () => ({ locked: !allLocked }))}>
                {allLocked ? <Lock className="size-4" strokeWidth={1.75} /> : <LockOpen className="size-4" strokeWidth={1.75} />}
              </IconButton>
              <IconButton label={t("flip")} disabled={allLocked} onClick={() => updateItems(ids, (it) => (it.locked ? {} : { flipX: !it.flipX }))}>
                <FlipHorizontal2 className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={t("duplicate")} onClick={duplicateSelected}>
                <Copy className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={t("front")} onClick={() => reorderSelected("front")}>
                <ArrowUpToLine className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={t("forward")} onClick={() => reorderSelected("forward")}>
                <ChevronUp className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={t("backward")} onClick={() => reorderSelected("backward")}>
                <ChevronDown className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={t("back")} onClick={() => reorderSelected("back")}>
                <ArrowDownToLine className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={t("delete")} disabled={allLocked} onClick={removeSelected} className="ml-auto hover:text-[#E5484D]">
                <Trash2 className="size-4" strokeWidth={1.75} />
              </IconButton>
            </div>
          </div>
        )}

        {/* Layer list: a keyboard-operable way to reach every sticker on the canvas. */}
        {items.length > 0 && (
          <div className="mt-7">
            <h3 className="mb-2 text-xs text-muted">{t("layers")}</h3>
            <ul className="flex flex-col gap-0.5">
              {[...items].reverse().map((it) => {
                const warn = warnings.overlapping.has(it.id) || warnings.onLogo.has(it.id) || warnings.nearEdge.has(it.id);
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      aria-pressed={selectedIds.includes(it.id)}
                      onClick={(e) =>
                        e.shiftKey || e.metaKey
                          ? select(selectedIds.includes(it.id) ? selectedIds.filter((x) => x !== it.id) : [...selectedIds, it.id])
                          : select([it.id])
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface aria-pressed:bg-surface-2"
                    >
                      <span className={`size-1.5 shrink-0 rounded-full ${warn ? "bg-[#E5484D]" : "bg-transparent"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      {it.locked && <Lock className="size-3 text-muted" strokeWidth={2} aria-label={t("lock")} />}
                      <span className="text-xs tabular-nums text-muted">{t("sizeMm", { w: roundMm(it.widthMm, 0), h: roundMm(it.heightMm, 0) })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
