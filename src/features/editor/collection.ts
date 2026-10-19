/**
 * The signed-in person's collection of layouts, auto-saved on this device.
 * (Phase 2 moves this to the database; the shape stays the same.)
 */
import { nanoid } from "nanoid";
import { DEFAULT_MODEL_ID, getLaptopModel } from "@/config/laptops";
import { parseLayout, type Layout } from "@/lib/layout";

export type SavedLayout = { id: string; name: string; createdAt: string; updatedAt: string; layout: Layout };

const LIST_KEY = "peelplan.collection.v1";
const CURRENT_KEY = "peelplan.collection.current";
const LEGACY_KEY = "peelplan.layout.v1";
const MIGRATED_KEY = "peelplan.collection.migrated";

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const EPOCH = new Date(0).toISOString();
const isoOr = (v: unknown, fallback: string) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : fallback);

export function emptyLayout(): Layout {
  const model = getLaptopModel(DEFAULT_MODEL_ID);
  return { version: 1, modelId: model.id, colorId: model.colors[0].id, keepLogoClear: true, items: [] };
}

export function listLayouts(): SavedLayout[] {
  return safe(() => {
    const raw = localStorage.getItem(LIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    // Entries are checked one by one: a single bad entry must not empty the list, or the next
    // autosave would write that empty list back over everyone's layouts.
    let list: SavedLayout[] = (Array.isArray(parsed) ? parsed : []).flatMap((e) => {
      const layout = e && typeof e === "object" ? parseLayout(e.layout) : null;
      if (!layout || typeof e.id !== "string" || !e.id) return [];
      const createdAt = isoOr(e.createdAt, EPOCH);
      return [{ id: e.id, name: String(e.name ?? "").slice(0, 60), createdAt, updatedAt: isoOr(e.updatedAt, createdAt), layout }];
    });
    // Once, after this update: the old single autosaved layout joins the collection (even if an
    // empty entry was created first), so nobody loses work they made before collections existed.
    if (!localStorage.getItem(MIGRATED_KEY)) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      const layout = legacy ? safe(() => parseLayout(JSON.parse(legacy)), null) : null;
      const already = layout && list.some((e) => JSON.stringify(e.layout.items) === JSON.stringify(layout.items));
      if (layout?.items.length && !already) {
        const now = new Date().toISOString();
        list = [{ id: nanoid(10), name: "", createdAt: now, updatedAt: now, layout }, ...list];
        localStorage.setItem(LIST_KEY, JSON.stringify(list));
      }
      localStorage.setItem(MIGRATED_KEY, "1");
    }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, []);
}

function writeList(list: SavedLayout[]) {
  safe(() => localStorage.setItem(LIST_KEY, JSON.stringify(list)), undefined);
}

export const getCurrentId = () => safe(() => localStorage.getItem(CURRENT_KEY), null);
export const setCurrentId = (id: string) => safe(() => localStorage.setItem(CURRENT_KEY, id), undefined);

export function getLayout(id: string) {
  return listLayouts().find((e) => e.id === id) ?? null;
}

function insertLayout(layout: Layout, name: string): SavedLayout {
  const now = new Date().toISOString();
  const entry: SavedLayout = { id: nanoid(10), name, createdAt: now, updatedAt: now, layout };
  writeList([entry, ...listLayouts()]);
  return entry;
}

/** Adds a layout and makes it the one the editor opens next. */
export function createLayout(layout: Layout = emptyLayout(), name = ""): SavedLayout {
  const entry = insertLayout(layout, name);
  setCurrentId(entry.id);
  return entry;
}

/** Autosave target: updates the entry in place (creating it if it was deleted meanwhile). */
export function saveLayoutEntry(id: string, layout: Layout) {
  const list = listLayouts();
  const now = new Date().toISOString();
  const i = list.findIndex((e) => e.id === id);
  if (i >= 0) list[i] = { ...list[i], layout, updatedAt: now };
  else list.unshift({ id, name: "", createdAt: now, updatedAt: now, layout });
  writeList(list);
}

export function renameLayout(id: string, name: string) {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
  writeList(listLayouts().map((e) => (e.id === id ? { ...e, name: clean } : e)));
}

/** Copies a layout without changing which one the editor treats as last used. */
export function duplicateLayout(id: string, copySuffix: string) {
  const src = getLayout(id);
  if (!src) return null;
  return insertLayout(structuredClone(src.layout), src.name ? `${src.name} ${copySuffix}`.slice(0, 60) : "");
}

/** Whether a sticker image is placed in any saved layout other than `exceptId`. */
export function isAssetUsedElsewhere(assetId: string, exceptId: string | null) {
  return listLayouts().some((e) => e.id !== exceptId && e.layout.items.some((i) => i.assetId === assetId));
}

export function deleteLayout(id: string) {
  writeList(listLayouts().filter((e) => e.id !== id));
  if (getCurrentId() === id) safe(() => localStorage.removeItem(CURRENT_KEY), undefined);
}

/** Which layout the editor opens: ?layout=, else the last one used, else the newest, else a new one. */
export function resolveEditorLayout(requested: string | null): SavedLayout {
  const list = listLayouts();
  const pick = (requested && list.find((e) => e.id === requested)) || list.find((e) => e.id === getCurrentId()) || list[0];
  if (pick) {
    setCurrentId(pick.id);
    return pick;
  }
  return createLayout();
}
