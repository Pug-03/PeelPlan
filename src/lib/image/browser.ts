import type { Rgba } from "./mask";

/** Longest edge kept for uploaded photos; enough for ~20 px/mm on a 100 mm sticker. */
export const MAX_UPLOAD_EDGE = 2400;

export async function fileToRgba(file: Blob, maxEdge = MAX_UPLOAD_EDGE): Promise<Rgba> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s);
  const h = Math.round(bmp.height * s);
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const id = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: id.data };
}

export function rgbaToCanvas(img: Rgba, target?: HTMLCanvasElement) {
  const c = target ?? document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

export const rgbaToPngDataUrl = (img: Rgba) => rgbaToCanvas(img).toDataURL("image/png");

/** Rasterises any image URL (SVG or raster) to a PNG data URL, at `pxWidth` or its natural width. PDF export needs PNG. */
export function svgToPngDataUrl(svgDataUrl: string, pxWidth?: number): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth;
      const w = Math.round(pxWidth ?? img.naturalWidth);
      const h = Math.round(w * ratio);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve({ src: c.toDataURL("image/png"), width: w, height: h });
    };
    img.onerror = reject;
    img.src = svgDataUrl;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
