import { beforeEach, describe, expect, it } from "vitest";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { MAX_ITEMS, MAX_SIZE_MM, POSITION_MARGIN_MM, parseLayout, type StickerAsset } from "@/lib/layout";
import { currentLayout, useEditor } from "./store";

const asset: StickerAsset = { id: "lib:a", src: "data:image/png;base64,", pxWidth: 100, pxHeight: 50, defaultWidthMm: 40, source: "library" };
const initial = useEditor.getState();

beforeEach(() => useEditor.setState({ ...initial, items: [], past: [], future: [], assets: { [asset.id]: asset }, selectedIds: [] }, true));

describe("editor store history", () => {
  it("adds at physical size with aspect kept", () => {
    const id = useEditor.getState().addItem(asset, "A");
    const it = useEditor.getState().items.find((i) => i.id === id)!;
    expect(it.widthMm).toBe(40);
    expect(it.heightMm).toBe(20);
  });

  it("undo/redo round-trips a move", () => {
    const id = useEditor.getState().addItem(asset, "A")!;
    const x0 = useEditor.getState().items[0].xMm;
    useEditor.getState().updateItems([id], (i) => ({ xMm: i.xMm + 10 }));
    useEditor.getState().undo();
    expect(useEditor.getState().items[0].xMm).toBe(x0);
    useEditor.getState().redo();
    expect(useEditor.getState().items[0].xMm).toBe(x0 + 10);
  });

  it("does not record no-op changes", () => {
    const id = useEditor.getState().addItem(asset, "A")!;
    const n = useEditor.getState().past.length;
    useEditor.getState().updateItems([id], (i) => ({ xMm: i.xMm }));
    useEditor.getState().setColor(useEditor.getState().colorId);
    useEditor.getState().reorderSelected("front");
    expect(useEditor.getState().past.length).toBe(n);
  });

  it("removing an asset also scrubs it from undo history", () => {
    useEditor.getState().addItem(asset, "A");
    useEditor.getState().removeAsset(asset.id);
    useEditor.getState().undo();
    expect(useEditor.getState().items.some((i) => i.assetId === asset.id)).toBe(false);
  });

  it("keeps every edit inside what parseLayout accepts", () => {
    const id = useEditor.getState().addItem(asset, "A")!;
    const lid = lidGeometry(getLaptopModel(useEditor.getState().modelId));
    useEditor.getState().updateItems([id], () => ({ xMm: 5000, yMm: -9000, widthMm: 1e6, heightMm: 1e6 }));
    const it = useEditor.getState().items[0];
    expect(it.xMm).toBe(lid.widthMm + POSITION_MARGIN_MM);
    expect(it.yMm).toBe(-POSITION_MARGIN_MM);
    expect(it.widthMm).toBe(MAX_SIZE_MM);
    expect(parseLayout(JSON.parse(JSON.stringify(currentLayout(useEditor.getState()))))).not.toBeNull();
  });

  it("refuses to pass the item cap and says it refused", () => {
    for (let i = 0; i < MAX_ITEMS; i++) expect(useEditor.getState().addItem(asset, "A")).not.toBeNull();
    const hits = useEditor.getState().itemLimitHits;
    expect(useEditor.getState().addItem(asset, "too many")).toBeNull();
    expect(useEditor.getState().items).toHaveLength(MAX_ITEMS);
    expect(useEditor.getState().itemLimitHits).toBe(hits + 1);
    useEditor.getState().select([useEditor.getState().items[0].id]);
    useEditor.getState().duplicateSelected();
    expect(useEditor.getState().items).toHaveLength(MAX_ITEMS);
    expect(parseLayout(JSON.parse(JSON.stringify(currentLayout(useEditor.getState()))))).not.toBeNull();
  });

  it("pulls stickers fully onto a smaller lid, size included", () => {
    useEditor.setState({ modelId: "macbook-pro-16-m5" });
    const id = useEditor.getState().addItem(asset, "A")!;
    useEditor.getState().updateItems([id], () => ({ xMm: 350, yMm: 240, widthMm: 60, heightMm: 30 }));
    useEditor.getState().setModel("macbook-neo-13");
    const neo = lidGeometry(getLaptopModel("macbook-neo-13"));
    const it = useEditor.getState().items[0];
    expect(it.xMm).toBeCloseTo(neo.widthMm - 30, 6); // right edge on the lid, not the centre
    expect(it.yMm).toBeCloseTo(neo.heightMm - 15, 6);
    expect(it.widthMm).toBe(60);
  });

  it("falls back to a real model and colour for unknown ids", () => {
    useEditor.getState().hydrate({ version: 1, modelId: "nope", colorId: "plaid", keepLogoClear: true, items: [] }, {}, null);
    const s = useEditor.getState();
    expect(s.modelId).toBe("macbook-air-13-m5");
    expect(s.colorId).not.toBe("plaid");
  });

  it("hydrating another layout clears undo history and selection", () => {
    const id = useEditor.getState().addItem(asset, "A");
    useEditor.getState().hydrate({ version: 1, modelId: "macbook-air-13-m5", colorId: "silver", keepLogoClear: true, items: [] }, {}, null);
    const s = useEditor.getState();
    expect(s.items).toEqual([]);
    expect(s.past).toEqual([]);
    expect(s.selectedIds).not.toContain(id);
    s.undo();
    expect(useEditor.getState().items).toEqual([]);
  });
});
