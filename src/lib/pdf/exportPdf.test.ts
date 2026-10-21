import { readFileSync } from "node:fs";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { apply } from "../geometry";
import type { LayoutItem } from "../layout";
import { mmToPt } from "../scale";
import { DEFAULT_PDF_TEXT, contentToPageMatrix, exportLayoutPdf, rulerSegment, type PdfText } from "./exportPdf";
import { PAPER, planTiles } from "./tiling";

// 1×1 transparent PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const item = (o: Partial<LayoutItem> = {}): LayoutItem => ({
  id: "a",
  assetId: "img",
  label: "Star",
  locked: false,
  finish: "glossy",
  borderMm: 0,
  xMm: 60,
  yMm: 50,
  widthMm: 50,
  heightMm: 50,
  rotationDeg: 15,
  ...o,
});

function lidFor(id: string) {
  const m = getLaptopModel(id);
  const g = lidGeometry(m);
  return { modelName: m.name, ...g };
}

describe("content → page mapping", () => {
  it("keeps 1 mm = 2.8346 pt on both axes, on every tile", () => {
    const plan = planTiles(383.7, 276.1, PAPER.a4);
    for (const t of plan.tiles) {
      const M = contentToPageMatrix(plan, t);
      const a = apply(M, { x: 100, y: 100 });
      const b = apply(M, { x: 200, y: 150 });
      expect(b.x - a.x).toBeCloseTo(mmToPt(100), 9);
      expect(a.y - b.y).toBeCloseTo(mmToPt(50), 9); // y flips: content y-down, PDF y-up
    }
  });

  it("puts the tile's top-left content corner at the page's printable top-left", () => {
    const plan = planTiles(383.7, 276.1, PAPER.letter);
    const t = plan.tiles[plan.tiles.length - 1];
    const p = apply(contentToPageMatrix(plan, t), { x: t.xMm, y: t.yMm });
    expect(p.x).toBeCloseTo(mmToPt(plan.options.marginMm), 9);
    expect(p.y).toBeCloseTo(mmToPt(plan.pageHeightMm - plan.options.marginMm), 9);
  });

  it("calibration ruler is exactly 100 mm", () => {
    const plan = planTiles(200, 100, PAPER.a4);
    const r = rulerSegment(plan);
    expect(r.x2 - r.x1).toBeCloseTo(mmToPt(100), 9);
  });
});

describe("exportLayoutPdf", () => {
  it.each([
    ["macbook-air-13-m5", "a4"],
    ["macbook-pro-16-m5", "a4"],
    ["macbook-pro-16-m5", "letter"],
  ] as const)("%s on %s produces exact paper-size pages", async (modelId, paper) => {
    const bytes = await exportLayoutPdf(
      lidFor(modelId),
      [item(), item({ id: "b", xMm: 200, flipX: true })],
      {
        img: { id: "img", src: PNG, pxWidth: 1, pxHeight: 1, defaultWidthMm: 50, source: "library" },
      },
      { paper, mode: "guide", includeImages: true },
    );
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();
    expect(pages.length).toBeGreaterThanOrEqual(3); // cover + ≥1 tile + coordinates
    const sheet = PAPER[paper];
    for (const p of pages) {
      const { width, height } = p.getSize();
      const [w, h] = width < height ? [width, height] : [height, width];
      expect(w).toBeCloseTo(mmToPt(sheet.widthMm), 2);
      expect(h).toBeCloseTo(mmToPt(sheet.heightMm), 2);
    }
  });

  it("template mode works without images", async () => {
    const bytes = await exportLayoutPdf(lidFor("macbook-air-15-m5"), [item()], {}, { paper: "a4", mode: "template", includeImages: false });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  });
});

describe("localised PDF", () => {
  const font = (name: string) => readFileSync(new URL(`./fonts/${name}`, import.meta.url));
  const fonts = { regular: font("Anuphan-Medium.ttf"), bold: font("Anuphan-Bold.ttf") };
  const thai = (): PdfText => ({
    ...DEFAULT_PDF_TEXT,
    mm: "มม.",
    coordTitle: "ตารางพิกัด",
    hingeNote: vi.fn((model: string) => `${model} - ด้านบานพับอยู่ล่าง`),
    rotationCw: vi.fn((deg: number) => `${deg}° ตามเข็ม`),
  });
  const baseFonts = async (bytes: Uint8Array) => {
    const doc = await PDFDocument.load(bytes);
    return doc.context
      .enumerateIndirectObjects()
      .map(([, o]) => (o instanceof PDFDict && o.get(PDFName.of("Type")) === PDFName.of("Font") ? String(o.get(PDFName.of("BaseFont"))) : null))
      .filter(Boolean);
  };

  it("embeds the Thai font and prints the caller's copy and Thai sticker names", async () => {
    const text = thai();
    const lid = lidFor("macbook-air-13-m5");
    const bytes = await exportLayoutPdf(lid, [item({ label: "แมวน้อย" })], {}, { paper: "a4", mode: "template", includeImages: false, text, fonts });
    expect((await baseFonts(bytes)).some((f) => f!.includes("Anuphan"))).toBe(true);
    expect(text.hingeNote).toHaveBeenCalledWith(lid.modelName);
    expect(text.rotationCw).toHaveBeenCalledWith(15);
  });

  it("falls back to Helvetica and ASCII English when the font is missing or broken", async () => {
    for (const f of [undefined, null, { regular: new Uint8Array([1, 2, 3]), bold: new Uint8Array([4]) }]) {
      const text = thai();
      const bytes = await exportLayoutPdf(
        lidFor("macbook-air-13-m5"),
        [item({ label: "แมวน้อย" })],
        {},
        { paper: "a4", mode: "guide", includeImages: false, text, fonts: f },
      );
      expect(await baseFonts(bytes)).toEqual(expect.arrayContaining(["/Helvetica"]));
      expect(text.hingeNote).not.toHaveBeenCalled();
    }
  });
});
