"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { DEFAULT_MODEL_ID, getLaptopModel, lidGeometry } from "@/config/laptops";
import { boundingBox, corners } from "@/lib/geometry";
import { MAX_ITEMS, clampItem, type Layout, type LayoutItem, type StickerAsset } from "@/lib/layout";
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
  /** Bumped whenever an add or duplicate was refused for hitting MAX_ITEMS, so the shell can say so. */
  itemLimitHits: number;
};

type Actions = {
  hydrate: (layout: Layout | null, assets: Record<string, StickerAsset>, calibration: number | null) => void;
  setModel: (id: string) => void;
  setColor: (id: string) => void;
  setKeepLogoClear: (v: boolean) => void;
  addAsset: (asset: StickerAsset) => void;
  removeAsset: (id: string) => void;
  /** Returns the new item's id, or null when the layout is already at MAX_ITEMS. */
  addItem: (asset: StickerAsset, label: string, at?: { xMm: number; yMm: number }) => string | null;
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

/** Centre that keeps a `size`-wide sticker inside a lid `extent` mm across; centred when it is too big to fit. */
const onLid = (centre: number, size: number, extent: number) => (size >= extent ? extent / 2 : Math.min(Math.max(centre, size / 2), extent - size / 2));

/** The lid the layout is currently on, for the position clamp. */
const currentLid = (s: Pick<State, "modelId">) => lidGeometry(getLaptopModel(s.modelId));

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
  itemLimitHits: 0,

  hydrate: (layout, assets, calibration) =>
    set((s) => {
      const resolved = layout ? resolveModel(layout.modelId, layout.colorId) : null;
      const lid = resolved ? lidGeometry(getLaptopModel(resolved.modelId)) : null;
      return {
        ...(layout && resolved && lid
          ? {
              ...resolved,
              keepLogoClear: layout.keepLogoClear,
              // Clamped on the way in too, so what the canvas shows is what the next autosave writes.
              items: layout.items.filter((i) => assets[i.assetId] || s.assets[i.assetId]).map((i) => clampItem(i, lid)),
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
      };
    }),

  setModel: (id) =>
    set((s) => {
      const model = getLaptopModel(id);
      const colorId = model.colors.some((c) => c.id === s.colorId) ? s.colorId : model.colors[0].id;
      // Keep stickers at their physical size; pull each one fully onto the smaller lid rather than
      // just capping its centre, which used to leave half of it hanging off the edge for good.
      const lid = lidGeometry(model);
      const items = s.items.map((it) => {
        const b = boundingBox(corners(it));
        return { ...it, xMm: onLid(it.xMm, b.width, lid.widthMm), yMm: onLid(it.yMm, b.height, lid.heightMm) };
      });
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
    // A layout above MAX_ITEMS no longer passes parseLayout, so it would be dropped on the next load.
    if (get().items.length >= MAX_ITEMS) {
      set((s) => ({ itemLimitHits: s.itemLimitHits + 1 }));
      return null;
    }
    const id = nanoid(8);
    const lid = lidGeometry(getLaptopModel(get().modelId));
    const widthMm = asset.defaultWidthMm;
    const heightMm = (widthMm * asset.pxHeight) / asset.pxWidth;
    const spot = at ?? findFreeSpot({ widthMm, heightMm }, get().items, lid, get().keepLogoClear);
    const item: LayoutItem = clampItem(
      {
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
      },
      lid,
    );
    set((s) => ({ ...withHistory(s), items: [...s.items, item], selectedIds: [id] }));
    return id;
  },

  updateItems: (ids, patch, opts) =>
    set((s) => {
      const target = new Set(ids);
      const lid = currentLid(s);
      let changed = false;
      const items = s.items.map((it) => {
        if (!target.has(it.id)) return it;
        const p = patch(it);
        if (!(Object.keys(p) as (keyof LayoutItem)[]).some((k) => p[k] !== it[k])) return it;
        // Typed coordinates, arrow nudges and transformer drops all land here; clamping once means
        // no gesture can push the layout past what parseLayout accepts on the next load.
        const next = clampItem({ ...it, ...p }, lid);
        if ((Object.keys(next) as (keyof LayoutItem)[]).every((k) => next[k] === it[k])) return it;
        changed = true;
        return next;
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
      const lid = currentLid(s);
      const room = MAX_ITEMS - s.items.length;
      const picked = s.items.filter((i) => s.selectedIds.includes(i.id));
      if (!picked.length) return {};
      if (room <= 0) return { itemLimitHits: s.itemLimitHits + 1 };
      const copies = picked.slice(0, room).map((i) => clampItem({ ...i, id: nanoid(8), xMm: i.xMm + 8, yMm: i.yMm + 8, locked: false }, lid));
      return {
        ...withHistory(s),
        items: [...s.items, ...copies],
        selectedIds: copies.map((c) => c.id),
        itemLimitHits: copies.length < picked.length ? s.itemLimitHits + 1 : s.itemLimitHits,
      };
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
