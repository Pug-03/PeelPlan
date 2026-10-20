import { lidGeometry, type LaptopModel } from "@/config/laptops";
import { downloadBlob } from "@/lib/image/browser";
import { roundMm } from "@/lib/scale";
import { stageHandle } from "./LidStage";

/** Width of the lid on the share card, in pixels. */
const LID_PX = 2400;
const INK = "#1B1B1F";
const MUTED = "#6E6E76";

/** The PeelPlan "peeling dot", same paths as RulerMark in components/Wordmark.tsx (32 × 32 box). */
const MARK_DOT = "M27.6 19.1A12 12 0 1 1 19.1 4.4Z";
const MARK_FLAP = "M19.1 4.4Q18.4 16.8 27.6 19.1Z";

/**
 * Renders just the lid (stickers and lighting, no transformer, warnings, guides or rulers) at
 * `pixelRatio` times the on-screen size. Stickers are data URLs or same-origin, so the canvas stays clean.
 */
export function renderLid(pixelRatio: number): HTMLCanvasElement | null {
  const stage = stageHandle.stage;
  if (!stage) return null;
  const chrome = stage.find(".overlay, Transformer").filter((n) => n.visible());
  chrome.forEach((n) => n.visible(false));
  try {
    return stage.toCanvas({ ...stageHandle.lidRectPx, pixelRatio });
  } finally {
    // Restored before the next frame, so nothing flickers on screen.
    chrome.forEach((n) => n.visible(true));
  }
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const dot = new Path2D(MARK_DOT);
  const flap = new Path2D(MARK_FLAP);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.fillStyle = "#D7FF3A";
  ctx.fill(dot);
  ctx.stroke(dot);
  ctx.save();
  ctx.translate(-0.6, 1);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  ctx.fill(flap);
  ctx.restore();
  ctx.fillStyle = "#fff";
  ctx.fill(flap);
  ctx.stroke(flap);
  ctx.restore();
}

/** The lid centred on a light card with the wordmark and the model at 1:1, as a PNG. */
export async function shareCardBlob(model: LaptopModel, colorId: string): Promise<Blob | null> {
  const r = stageHandle.lidRectPx;
  if (!r.width) return null;
  const lid = renderLid(LID_PX / r.width);
  if (!lid) return null;
  const { widthMm, heightMm, cornerRadiusMm } = lidGeometry(model);
  const lw = lid.width;
  const lh = lid.height;
  const pad = Math.round(lw * 0.1);
  const footer = Math.round(lw * 0.14);
  const W = lw + pad * 2;
  const H = pad + lh + footer;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  // Warm off-white ground, a touch brighter behind the lid.
  const bg = ctx.createRadialGradient(W / 2, pad + lh / 2, lw * 0.1, W / 2, pad + lh / 2, W * 0.75);
  bg.addColorStop(0, "#FCFBF8");
  bg.addColorStop(1, "#EFEEE8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft drop shadow (wide + contact), then the lid clipped to its rounded corners.
  const radius = cornerRadiusMm * (lw / widthMm);
  const shape = () => {
    ctx.beginPath();
    ctx.roundRect(pad, pad, lw, lh, radius);
  };
  ctx.save();
  ctx.fillStyle = model.colors.find((col) => col.id === colorId)?.hex ?? model.colors[0].hex;
  ctx.shadowColor = "rgba(27,27,31,0.20)";
  ctx.shadowBlur = lw * 0.05;
  ctx.shadowOffsetY = lw * 0.024;
  shape();
  ctx.fill();
  ctx.shadowColor = "rgba(27,27,31,0.14)";
  ctx.shadowBlur = lw * 0.006;
  ctx.shadowOffsetY = lw * 0.002;
  ctx.fill();
  ctx.restore();
  ctx.save();
  shape();
  ctx.clip();
  ctx.drawImage(lid, pad, pad);
  ctx.restore();

  // Footer: wordmark on the left, model and scale on the right, in the app's own font.
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const nameSize = Math.round(lw * 0.027);
  const metaSize = Math.round(lw * 0.017);
  await Promise.all([`600 ${nameSize}px ${family}`, `400 ${metaSize}px ${family}`].map((f) => document.fonts?.load(f).catch(() => undefined)));
  const cy = pad + lh + footer / 2;
  const mark = Math.round(lw * 0.04);
  drawMark(ctx, pad, cy - mark / 2, mark);
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.font = `600 ${nameSize}px ${family}`;
  ctx.fillText("PeelPlan", pad + mark * 1.25, cy + nameSize * 0.04);
  ctx.textAlign = "right";
  ctx.font = `600 ${metaSize}px ${family}`;
  ctx.fillText(model.name, pad + lw, cy - metaSize * 0.7);
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${metaSize}px ${family}`;
  ctx.fillText(`1:1 · ${roundMm(widthMm)} × ${roundMm(heightMm)} mm`, pad + lw, cy + metaSize * 0.75);

  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

/** Builds the share card and downloads it as peelplan-<model>.png. Resolves false if it couldn't. */
export async function saveShareImage(model: LaptopModel, colorId: string): Promise<boolean> {
  try {
    const blob = await shareCardBlob(model, colorId);
    if (!blob) return false;
    downloadBlob(blob, `peelplan-${model.id}.png`);
    return true;
  } catch {
    return false;
  }
}
