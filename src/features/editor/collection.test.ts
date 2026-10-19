// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  createLayout,
  deleteLayout,
  duplicateLayout,
  emptyLayout,
  getCurrentId,
  getLayout,
  isAssetUsedElsewhere,
  listLayouts,
  renameLayout,
  resolveEditorLayout,
  saveLayoutEntry,
} from "./collection";

beforeEach(() => localStorage.clear());

describe("layout collection", () => {
  it("migrates the old single autosave into the first entry", () => {
    const old = { ...emptyLayout(), items: [{ id: "a", assetId: "lib:x", label: "x", xMm: 10, yMm: 10, widthMm: 20, heightMm: 20, rotationDeg: 0, locked: false, finish: "glossy", borderMm: 0 }] };
    localStorage.setItem("peelplan.layout.v1", JSON.stringify(old));
    const list = listLayouts();
    expect(list).toHaveLength(1);
    expect(list[0].layout.items).toHaveLength(1);
  });

  it("creates, autosaves, renames, duplicates and deletes", () => {
    const a = createLayout();
    saveLayoutEntry(a.id, { ...a.layout, colorId: "midnight" });
    renameLayout(a.id, "Desk laptop");
    expect(getLayout(a.id)).toMatchObject({ name: "Desk laptop", layout: { colorId: "midnight" } });
    const b = duplicateLayout(a.id, "(copy)")!;
    expect(b.name).toBe("Desk laptop (copy)");
    expect(listLayouts()).toHaveLength(2);
    deleteLayout(a.id);
    expect(listLayouts().map((e) => e.id)).toEqual([b.id]);
  });

  it("opens the requested layout, else the last used, else a new one", () => {
    const fresh = resolveEditorLayout(null);
    expect(listLayouts()).toHaveLength(1);
    const other = createLayout();
    expect(resolveEditorLayout(fresh.id).id).toBe(fresh.id);
    expect(resolveEditorLayout("missing").id).toBe(fresh.id); // last used
    expect(other.id).not.toBe(fresh.id);
  });

  it("skips a damaged entry instead of dropping the whole collection", () => {
    const good = createLayout();
    const list = JSON.parse(localStorage.getItem("peelplan.collection.v1")!);
    localStorage.setItem("peelplan.collection.v1", JSON.stringify([null, { id: "x" }, { ...list[0], updatedAt: 42 }]));
    expect(listLayouts().map((e) => e.id)).toEqual([good.id]);
  });

  it("survives an unreadable legacy save", () => {
    createLayout();
    localStorage.removeItem("peelplan.collection.migrated");
    localStorage.setItem("peelplan.layout.v1", "{not json");
    expect(listLayouts()).toHaveLength(1);
  });

  it("duplicating keeps the last-used layout and trims names", () => {
    const a = createLayout();
    renameLayout(a.id, "  Desk \n laptop  ");
    expect(getLayout(a.id)?.name).toBe("Desk laptop");
    duplicateLayout(a.id, "(copy)");
    expect(getCurrentId()).toBe(a.id);
  });

  it("knows when an upload is still placed in another layout", () => {
    const item = { id: "a", assetId: "up:1", label: "", xMm: 10, yMm: 10, widthMm: 20, heightMm: 20, rotationDeg: 0, locked: false, finish: "glossy" as const, borderMm: 0 };
    const a = createLayout({ ...emptyLayout(), items: [item] });
    const b = createLayout();
    expect(isAssetUsedElsewhere("up:1", b.id)).toBe(true);
    expect(isAssetUsedElsewhere("up:1", a.id)).toBe(false);
  });
});
