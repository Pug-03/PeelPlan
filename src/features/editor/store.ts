"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { DEFAULT_MODEL_ID, getLaptopModel, lidGeometry } from "@/config/laptops";
import type { Layout, LayoutItem, StickerAsset } from "@/lib/layout";
import { findFreeSpot } from "@/lib/placement";

const HISTORY_LIMIT = 100;

type Snapshot = Pick<Layout, "modelId" | "colorId" | "keepLogoClear" | "items">;

export type ViewMode = "actual" | "fit";

type State = Snapshot & {
  assets: Record<string, StickerAsset>;
  selectedIds: string[];
  past: Snapshot[];
  future: Snapshot[];
  /** Calibrated CSS px per mm for this screen; null until calibrated. */
  calibratedPxPerMm: number | null;
  viewMode: ViewMode;
  zoom: number;
  hydrated: boolean;
};

type Actions = {
  hydrate: (layout: Layout | null, assets: Record<string, StickerAsset>, calibration: number | null) => void;
  setModel: (id: string) => void;
  setColor: (id: string) => void;
  setKeepLogoClear: (v: boolean) => void;
  addAsset: (asset: StickerAsset) => void;
  removeAsset: (id: string) => void;
  addItem: (asset: StickerAsset, label: string, at?: { xMm: number; yMm: number }) => string;
  /** Applies a patch to items. `history: false` for live previews inside one gesture. */
  updateItems: (ids: string[], patch: (it: LayoutItem) => Partial<LayoutItem>, opts?: { history?: boolean }) => void;
  checkpoint: () => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  reorderSelected: (dir: "front" | "back" | "forward" | "backward") => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  undo: () => void;
  redo: () => void;
  setCalibration: (pxPerMm: number | null) => void;
  setViewMode: (m: ViewMode) => void;
  setZoom: (z: number) => void;
};

const snapshot = (s: State): Snapshot => ({ modelId: s.modelId, colorId: s.colorId, keepLogoClear: s.keepLogoClear, items: s.items });

const withHistory = (s: State): Pick<State, "past" | "future"> => ({
  past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
  future: [],
});

const initialModel = getLaptopModel(DEFAULT_MODEL_ID);

/** Maps possibly-unknown ids (old saves, share links) onto a real model and one of its colours. */
function resolveModel(modelId: string, colorId: string) {
  const model = getLaptopModel(modelId);
  return { modelId: model.id, colorId: model.colors.some((c) => c.id === colorId) ? colorId : model.colors[0].id };
}

export const useEditor = create<State & Actions>((set, get) => ({
  modelId: initialModel.id,
  colorId: initialModel.colors[0].id,
  keepLogoClear: true,
  items: [],
  assets: {},
  selectedIds: [],
  past: [],
  future: [],
  calibratedPxPerMm: null,
  viewMode: "fit",
  zoom: 1,
  hydrated: false,

  hydrate: (layout, assets, calibration) =>
    set((s) => ({
      ...(layout
        ? {
            ...resolveModel(layout.modelId, layout.colorId),
            keepLogoClear: layout.keepLogoClear,
            items: layout.items.filter((i) => assets[i.assetId] || s.assets[i.assetId]),
          }
        : {}),
      assets: { ...assets, ...s.assets },
      // A different layout starts clean: undo must never bring back the previous layout's stickers.
      selectedIds: [],
      past: [],
      future: [],
      calibratedPxPerMm: calibration,
      viewMode: calibration ? "actual" : "fit",
      zoom: 1,
      hydrated: true,
    })),

  setModel: (id) =>
    set((s) => {
      const model = getLaptopModel(id);
      const colorId = model.colors.some((c) => c.id === s.colorId) ? s.colorId : model.colors[0].id;
      // Keep stickers at their physical size; clamp centres so nothing is lost off a smaller lid.
      const { widthMm, heightMm } = lidGeometry(model);
      const items = s.items.map((it) => ({ ...it, xMm: Math.min(it.xMm, widthMm), yMm: Math.min(it.yMm, heightMm) }));
      return { ...withHistory(s), modelId: model.id, colorId, items };
    }),

  setColor: (colorId) => set((s) => (s.colorId === colorId ? {} : { ...withHistory(s), colorId })),
  setKeepLogoClear: (keepLogoClear) => set({ keepLogoClear }),

  addAsset: (asset) => set((s) => ({ assets: { ...s.assets, [asset.id]: asset } })),
  removeAsset: (id) =>
    set((s) => {
      const assets = { ...s.assets };
      delete assets[id];
      // Not undoable: the image is gone from storage, so strip it from history too
      // instead of letting undo resurrect blank stickers.
      const keep = (snap: Snapshot) => ({ ...snap, items: snap.items.filter((i) => i.assetId !== id) });
      return { assets, items: s.items.filter((i) => i.assetId !== id), past: s.past.map(keep), future: s.future.map(keep) };
    }),

  addItem: (asset, label, at) => {
    const id = nanoid(8);
    const lid = lidGeometry(getLaptopModel(get().modelId));
    const widthMm = asset.defaultWidthMm;
    const heightMm = (widthMm * asset.pxHeight) / asset.pxWidth;
    const spot = at ?? findFreeSpot({ widthMm, heightMm }, get().items, lid, get().keepLogoClear);
    const item: LayoutItem = {
      id,
      assetId: asset.id,
      label,
      xMm: spot.xMm,
      yMm: spot.yMm,
      widthMm,
      heightMm,
      rotationDeg: 0,
      flipX: false,
      locked: false,
      finish: "glossy",
      borderMm: 0,
    };
    set((s) => ({ ...withHistory(s), items: [...s.items, item], selectedIds: [id] }));
    return id;
  },

  updateItems: (ids, patch, opts) =>
    set((s) => {
      const target = new Set(ids);
      let changed = false;
      const items = s.items.map((it) => {
        if (!target.has(it.id)) return it;
        const p = patch(it);
        if (!(Object.keys(p) as (keyof LayoutItem)[]).some((k) => p[k] !== it[k])) return it;
        changed = true;
        return { ...it, ...p };
      });
      // No-op patches (click without drag, locked flip) must not create empty undo steps.
      if (!changed) return {};
      return opts?.history === false ? { items } : { ...withHistory(s), items };
    }),

  checkpoint: () => set((s) => withHistory(s)),

  removeSelected: () =>
    set((s) => {
      const sel = new Set(s.selectedIds);
      const items = s.items.filter((i) => !sel.has(i.id) || i.locked);
      return items.length === s.items.length ? {} : { ...withHistory(s), items, selectedIds: [] };
    }),

  duplicateSelected: () =>
    set((s) => {
      const copies = s.items.filter((i) => s.selectedIds.includes(i.id)).map((i) => ({ ...i, id: nanoid(8), xMm: i.xMm + 8, yMm: i.yMm + 8, locked: false }));
      if (!copies.length) return {};
      return { ...withHistory(s), items: [...s.items, ...copies], selectedIds: copies.map((c) => c.id) };
    }),

  reorderSelected: (dir) =>
    set((s) => {
      const sel = new Set(s.selectedIds);
      if (!sel.size) return {};
      const picked = s.items.filter((i) => sel.has(i.id));
      const rest = s.items.filter((i) => !sel.has(i.id));
      let items: LayoutItem[];
      if (dir === "front") items = [...rest, ...picked];
      else if (dir === "back") items = [...picked, ...rest];
      else {
        items = [...s.items];
        const step = dir === "forward" ? 1 : -1;
        const order = dir === "forward" ? [...items.keys()].reverse() : [...items.keys()];
        for (const i of order) {
          const j = i + step;
          if (sel.has(items[i].id) && j >= 0 && j < items.length && !sel.has(items[j].id)) [items[i], items[j]] = [items[j], items[i]];
        }
      }
      if (items.every((it, i) => it === s.items[i])) return {};
      return { ...withHistory(s), items };
    }),

  select: (selectedIds) => set({ selectedIds }),
  toggleSelect: (id) => set((s) => ({ selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return {};
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [snapshot(s), ...s.future],
        selectedIds: s.selectedIds.filter((id) => prev.items.some((i) => i.id === id)),
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return {};
      return { ...next, past: [...s.past, snapshot(s)], future: s.future.slice(1) };
    }),

  setCalibration: (calibratedPxPerMm) => set({ calibratedPxPerMm, viewMode: calibratedPxPerMm ? "actual" : "fit", zoom: 1 }),
  setViewMode: (viewMode) => set({ viewMode, zoom: 1 }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),

}));

export const currentLayout = (s: Snapshot): Layout => ({ version: 1, modelId: s.modelId, colorId: s.colorId, keepLogoClear: s.keepLogoClear, items: s.items });

/** Live size/rotation while a transformer gesture runs; kept out of the main store so it only re-renders the inspector. */
export const useLiveReadout = create<{ live: { w: number; h: number; r: number } | null; set: (v: { w: number; h: number; r: number } | null) => void }>(
  (set) => ({
    live: null,
    set: (live) => set({ live }),
  }),
);
