/**
 * Pixel operations on RGBA buffers. Pure (no DOM) so they run in workers and tests.
 *
 * Background removal here is a dependency-free edge flood fill: it works well for stickers
 * shot on a plain surface. A model-based remover can be plugged in later via `BackgroundRemover`.
 */

export type Rgba = { width: number; height: number; data: Uint8ClampedArray };

export type BackgroundRemover = (img: Rgba, opts: { tolerance: number }) => Promise<Rgba> | Rgba;

const dist = (d: Uint8ClampedArray, i: number, j: number) => {
  const dr = d[i] - d[j];
  const dg = d[i + 1] - d[j + 1];
  const db = d[i + 2] - d[j + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * Flood-fills from every border pixel through similar colours and clears alpha there.
 * `tolerance` is an RGB distance (0–441); 30–60 suits most desk/paper backgrounds.
 */
export function removeBackgroundByEdgeFill(img: Rgba, { tolerance }: { tolerance: number }): Rgba {
  const { width: w, height: h } = img;
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  // Reference colour per filled pixel: the seed it grew from, so gradual lighting is followed
  // but a sharp colour change (the sticker's edge) stops the fill.
  const seedOf = new Int32Array(w * h).fill(-1);

  const push = (p: number, seed: number) => {
    if (visited[p]) return;
    visited[p] = 1;
    seedOf[p] = seed;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, x);
    push((h - 1) * w + x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w, y * w);
    push(y * w + w - 1, y * w + w - 1);
  }

  while (stack.length) {
    const p = stack.pop()!;
    out[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    const seed = seedOf[p];
    const neighbours = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const n of neighbours) {
      if (n < 0 || visited[n]) continue;
      const local = dist(src, p * 4, n * 4);
      const global = dist(src, seed * 4, n * 4);
      if (local <= tolerance / 2 && global <= tolerance * 1.5) push(n, seed);
    }
  }
  return { width: w, height: h, data: out };
}

/** Softens the 1-px alpha edge so cut-outs do not look jagged. */
export function featherAlpha(img: Rgba): Rgba {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4 + 3;
      if (data[i] === 0) continue;
      const n = data[i - 4] + data[i + 4] + data[i - w * 4] + data[i + w * 4];
      if (n < 255 * 4) out[i] = Math.round((data[i] * 4 + n) / 8);
    }
  }
  return { width: w, height: h, data: out };
}

export type Component = { id: number; area: number; minX: number; minY: number; maxX: number; maxY: number };

/** 4-connected components of pixels with alpha ≥ `alphaMin`. Returns label map + stats (largest first). */
export function opaqueComponents(img: Rgba, alphaMin = 128) {
  const { width: w, height: h, data } = img;
  const labels = new Int32Array(w * h);
  const comps: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (labels[start] || data[start * 4 + 3] < alphaMin) continue;
    const id = comps.length + 1;
    const c: Component = { id, area: 0, minX: w, minY: h, maxX: 0, maxY: 0 };
    labels[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      c.area++;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (n >= 0 && !labels[n] && data[n * 4 + 3] >= alphaMin) {
          labels[n] = id;
          stack.push(n);
        }
      }
    }
    comps.push(c);
  }
  comps.sort((a, b) => b.area - a.area);
  return { labels, components: comps };
}

/** Keeps only the given component (plus faint pixels hugging it) and crops to its bbox + pad. */
export function isolateComponent(img: Rgba, labels: Int32Array, c: Component, padPx = 2) {
  const { width: w, height: h, data } = img;
  const x0 = Math.max(0, c.minX - padPx);
  const y0 = Math.max(0, c.minY - padPx);
  const x1 = Math.min(w - 1, c.maxX + padPx);
  const y1 = Math.min(h - 1, c.maxY + padPx);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = y * w + x;
      const si = p * 4;
      const di = ((y - y0) * cw + (x - x0)) * 4;
      const keep = labels[p] === c.id || (labels[p] === 0 && data[si + 3] > 0);
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = keep ? data[si + 3] : 0;
    }
  }
  return { image: { width: cw, height: ch, data: out } as Rgba, crop: { x: x0, y: y0, width: cw, height: ch } };
}

/**
 * Distance (px) from each pixel to the nearest opaque pixel, by a two-pass 5-7-11 chamfer
 * transform: O(pixels), within ~2% of Euclidean. Values are capped at `cap`.
 */
function distanceToOpaque(alpha: Uint8ClampedArray, w: number, h: number, cap: number) {
  const INF = (cap + 2) * 5;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = alpha[i] ? 0 : INF;
  const fwd: [number, number, number][] = [
    [-1, 0, 5],
    [-1, -1, 7],
    [0, -1, 5],
    [1, -1, 7],
    [-2, -1, 11],
    [-1, -2, 11],
    [1, -2, 11],
    [2, -1, 11],
  ];
  const relax = (x: number, y: number, dirs: [number, number, number][], sign: number) => {
    const i = y * w + x;
    let best = d[i];
    for (const [dx, dy, c] of dirs) {
      const nx = x + dx * sign;
      const ny = y + dy * sign;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const v = d[ny * w + nx] + c;
      if (v < best) best = v;
    }
    d[i] = best;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) relax(x, y, fwd, 1);
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) relax(x, y, fwd, -1);
  for (let i = 0; i < w * h; i++) d[i] /= 5;
  return d;
}

/** Adds a solid white die-cut margin of `radiusPx` around opaque pixels (output grows by radius each side). */
export function addDieCutBorder(img: Rgba, radiusPx: number): Rgba {
  const r = Math.max(0, Math.round(radiusPx));
  if (r === 0) return img;
  const w = img.width + 2 * r;
  const h = img.height + 2 * r;
  const out = new Uint8ClampedArray(w * h * 4);
  const solid = new Uint8ClampedArray(w * h);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] >= 128) solid[(y + r) * w + (x + r)] = 1;
  const dist = distanceToOpaque(solid, w, h, r);
  for (let p = 0; p < w * h; p++) {
    if (dist[p] > r + 0.5) continue;
    out[p * 4] = out[p * 4 + 1] = out[p * 4 + 2] = 255;
    // Half-pixel antialiasing on the outer edge.
    out[p * 4 + 3] = dist[p] <= r - 0.5 ? 255 : Math.round(255 * (r + 0.5 - dist[p]));
  }
  // Composite original over white.
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const si = (y * img.width + x) * 4;
      const di = ((y + r) * w + (x + r)) * 4;
      const a = img.data[si + 3] / 255;
      if (a === 0) continue;
      for (let k = 0; k < 3; k++) out[di + k] = Math.round(img.data[si + k] * a + out[di + k] * (1 - a));
      out[di + 3] = Math.max(out[di + 3], img.data[si + 3]);
    }
  }
  return { width: w, height: h, data: out };
}

/** Paints a circular brush into alpha: erase (alpha → 0) or restore from the original buffer. */
export function brush(img: Rgba, original: Rgba, cx: number, cy: number, radius: number, mode: "erase" | "restore") {
  const { width: w, height: h, data } = img;
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(h - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(w - 1, Math.ceil(cx + radius)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      const i = (y * w + x) * 4 + 3;
      data[i] = mode === "erase" ? 0 : original.data[i];
    }
  }
}
