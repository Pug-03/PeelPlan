import { parseLayout, type Layout, type StickerAsset } from "@/lib/layout";

const CALIBRATION_KEY = "peelplan.calibration.v1";
const DB_NAME = "peelplan";
const STORE = "assets";

function safeLocal<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Calibration is per physical screen; a laptop on an external monitor needs its own value.
 * The zoom bucket is part of the key because Safari's page zoom changes how big a CSS px is
 * without touching devicePixelRatio: a zoomed window must not reuse the 100% calibration and
 * keep claiming actual size. Rounded to one decimal so window borders and scrollbars don't
 * invalidate a good calibration.
 */
export function screenKey() {
  if (typeof window === "undefined") return "ssr";
  const zoom = window.innerWidth > 0 ? Math.round((window.outerWidth / window.innerWidth) * 10) / 10 : 1;
  return `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}z${zoom}`;
}

export const loadCalibration = (): number | null =>
  safeLocal(() => {
    const all = JSON.parse(localStorage.getItem(CALIBRATION_KEY) ?? "{}") as Record<string, number>;
    const v = all[screenKey()];
    return typeof v === "number" && v > 0 ? v : null;
  }, null);

export const saveCalibration = (pxPerMm: number | null) =>
  safeLocal(() => {
    const all = JSON.parse(localStorage.getItem(CALIBRATION_KEY) ?? "{}") as Record<string, number>;
    if (pxPerMm == null) delete all[screenKey()];
    else all[screenKey()] = pxPerMm;
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(all));
  }, undefined);

let dbPromise: Promise<IDBDatabase> | null = null;

/** One shared connection; reopened if another tab upgrades the schema. */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function write(op: (store: IDBObjectStore) => void) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    op(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export async function loadAssets(): Promise<Record<string, StickerAsset>> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(Object.fromEntries((req.result as StickerAsset[]).map((a) => [a.id, a])));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

/** Resolves once committed; false when storage is unavailable or full (the asset still lives in memory). */
export async function saveAsset(asset: StickerAsset): Promise<boolean> {
  try {
    await write((st) => st.put(asset));
    return true;
  } catch {
    return false;
  }
}

export async function deleteAsset(id: string) {
  try {
    await write((st) => st.delete(id));
  } catch {
    /* ignore */
  }
}

/* Share links: the layout (not uploaded images) is deflated into the URL hash. */

const toBase64Url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Upper bound for an inflated share payload; blocks deflate bombs in crafted links. */
const MAX_SHARE_BYTES = 512 * 1024;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, maxBytes = Infinity) {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RangeError("Share payload too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

export async function encodeShare(layout: Layout) {
  const json = new TextEncoder().encode(JSON.stringify(layout));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeShare(token: string): Promise<Layout | null> {
  try {
    if (token.length > 200_000) return null;
    const bytes = await pipe(fromBase64Url(token), new DecompressionStream("deflate-raw"), MAX_SHARE_BYTES);
    return parseLayout(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
