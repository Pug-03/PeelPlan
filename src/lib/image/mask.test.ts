import { describe, expect, it } from "vitest";
import { addDieCutBorder, isolateComponent, opaqueComponents, removeBackgroundByEdgeFill, type Rgba } from "./mask";

function canvas(w: number, h: number, fill: [number, number, number]): Rgba {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...fill, 255], i * 4);
  return { width: w, height: h, data };
}
function rect(img: Rgba, x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data.set([...c, 255], (y * img.width + x) * 4);
}
const alphaAt = (img: Rgba, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

describe("edge-fill background removal", () => {
  it("clears a plain background and keeps the subject", () => {
    const img = canvas(40, 30, [240, 240, 238]);
    rect(img, 10, 8, 30, 22, [220, 40, 40]);
    const out = removeBackgroundByEdgeFill(img, { tolerance: 40 });
    expect(alphaAt(out, 0, 0)).toBe(0);
    expect(alphaAt(out, 5, 5)).toBe(0);
    expect(alphaAt(out, 20, 15)).toBe(255);
  });

  it("follows a soft lighting gradient", () => {
    const img = canvas(60, 10, [0, 0, 0]);
    for (let x = 0; x < 60; x++) for (let y = 0; y < 10; y++) img.data.set([200 + x / 2, 200 + x / 2, 200 + x / 2, 255], (y * 60 + x) * 4);
    const out = removeBackgroundByEdgeFill(img, { tolerance: 30 });
    expect(alphaAt(out, 30, 5)).toBe(0);
  });
});

describe("components", () => {
  it("separates a sticker from a coin and isolates the biggest", () => {
    const img = canvas(50, 30, [0, 0, 0]);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
    rect(img, 2, 2, 22, 22, [10, 200, 10]); // sticker 20×20
    rect(img, 35, 10, 41, 16, [180, 180, 180]); // coin 6×6
    const { labels, components } = opaqueComponents(img);
    expect(components.map((c) => c.area)).toEqual([400, 36]);
    const { image, crop } = isolateComponent(img, labels, components[0], 1);
    expect(crop).toEqual({ x: 1, y: 1, width: 22, height: 22 });
    expect(image.width).toBe(22);
  });
});

describe("die-cut border", () => {
  it("grows the image by the radius and paints white around the subject", () => {
    const img = canvas(10, 10, [0, 0, 0]);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
    rect(img, 3, 3, 7, 7, [0, 0, 255]);
    const out = addDieCutBorder(img, 2);
    expect(out.width).toBe(14);
    const px = (x: number, y: number) => Array.from(out.data.slice((y * 14 + x) * 4, (y * 14 + x) * 4 + 4));
    expect(px(4, 7)).toEqual([255, 255, 255, 255]); // border ring
    expect(px(7, 7)).toEqual([0, 0, 255, 255]); // subject preserved
    expect(px(0, 0)[3]).toBe(0); // far corner stays clear
  });
});

describe("die-cut performance", () => {
  it("borders a large sticker quickly (linear-time dilation)", () => {
    const img = canvas(800, 800, [0, 0, 0]);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
    rect(img, 50, 50, 750, 750, [255, 0, 0]);
    const t0 = performance.now();
    const out = addDieCutBorder(img, 20);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(out.width).toBe(840);
    const a = (x: number, y: number) => out.data[(y * 840 + x) * 4 + 3];
    expect(a(20 + 50 - 10, 400)).toBe(255); // 10 px outside the edge: inside the border
    expect(a(20 + 50 - 25, 400)).toBe(0); // 25 px outside: beyond the 20 px border
  });
});
