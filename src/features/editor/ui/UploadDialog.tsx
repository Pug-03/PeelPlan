"use client";

import { nanoid } from "nanoid";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REFERENCE_OBJECTS, SIZE_PRESETS_MM } from "@/config/references";
import { fileToRgba, rgbaToCanvas, rgbaToPngDataUrl } from "@/lib/image/browser";
import { addDieCutBorder, brush, featherAlpha, isolateComponent, opaqueComponents, removeBackgroundByEdgeFill, type Rgba } from "@/lib/image/mask";
import type { StickerAsset } from "@/lib/layout";
import { mmPerImagePx, roundMm } from "@/lib/scale";
import { Button, NumberField, Segmented, Toggle } from "./controls";
import { Dialog } from "./Dialog";

type Step = "clean" | "size";
type SizeMode = "type" | "preset" | "measure";
type Pt = { x: number; y: number };

const clone = (img: Rgba): Rgba => ({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) });

/** Draws an RGBA buffer over a checkerboard, fitted into a canvas element. Returns image→canvas scale. */
function paint(canvas: HTMLCanvasElement, img: Rgba, dimOthers?: { labels: Int32Array; keep: number }) {
  const maxW = canvas.parentElement?.clientWidth ?? 600;
  const s = Math.min(1, maxW / img.width, 420 / img.height);
  canvas.width = Math.round(img.width * s);
  canvas.height = Math.round(img.height * s);
  const ctx = canvas.getContext("2d")!;
  const cell = 10;
  for (let y = 0; y < canvas.height; y += cell)
    for (let x = 0; x < canvas.width; x += cell) {
      ctx.fillStyle = (x / cell + y / cell) % 2 ? "#e9e9ec" : "#f7f7f8";
      ctx.fillRect(x, y, cell, cell);
    }
  let src = img;
  if (dimOthers) {
    src = clone(img);
    for (let p = 0; p < dimOthers.labels.length; p++) if (dimOthers.labels[p] !== dimOthers.keep && src.data[p * 4 + 3]) src.data[p * 4 + 3] = 60;
  }
  ctx.drawImage(rgbaToCanvas(src), 0, 0, canvas.width, canvas.height);
  return s;
}

export function UploadDialog({ file, onClose, onDone }: { file: File | null; onClose: () => void; onDone: (asset: StickerAsset, label: string) => void }) {
  const t = useTranslations("upload");
  const locale = useLocale() as "th" | "en";
  const [step, setStep] = useState<Step>("clean");
  const [original, setOriginal] = useState<Rgba | null>(null);
  const [work, setWork] = useState<Rgba | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(!!file);
  const [bgOn, setBgOn] = useState(true);
  const [tolerance, setTolerance] = useState(42);
  // The slider shows the draft live; the expensive fill runs once the user lets go.
  const [toleranceDraft, setToleranceDraft] = useState(42);
  const [tool, setTool] = useState<"none" | "erase" | "restore">("none");
  const [brushPx, setBrushPx] = useState(18);
  const [pick, setPick] = useState<number | null>(null);
  const [dieCut, setDieCut] = useState(true);
  const [dieCutMm, setDieCutMm] = useState(1.5);
  const [sizeMode, setSizeMode] = useState<SizeMode>("type");
  const [widthMm, setWidthMm] = useState(60);
  const [refId, setRefId] = useState(REFERENCE_OBJECTS.find((r) => r.locales.includes(locale))!.id);
  const [refPts, setRefPts] = useState<Pt[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);
  const painting = useRef(false);
  const paintRaf = useRef(0);

  // Load the photo. The dialog is keyed by file, so state starts fresh for each upload.
  useEffect(() => {
    if (!file) return;
    fileToRgba(file, 1600)
      .then((img) => {
        setOriginal(img);
      })
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  }, [file]);

  // Re-run background removal when its inputs change.
  useEffect(() => {
    if (!original) return;
    const id = setTimeout(() => {
      setWork(bgOn ? featherAlpha(removeBackgroundByEdgeFill(original, { tolerance })) : clone(original));
      setPick(null);
    }, 60);
    return () => clearTimeout(id);
  }, [original, bgOn, tolerance]);

  const comps = useMemo(() => (work ? opaqueComponents(work) : null), [work]);
  // Specks under 2% of the biggest shape are noise, not stickers.
  const pieceCount = comps?.components.filter((c) => c.area >= comps.components[0].area * 0.02).length ?? 0;
  const chosen = comps ? (comps.components.find((c) => c.id === pick) ?? comps.components[0]) : undefined;
  // Crop tight to the opaque edge: any padding would count toward the physical size the user sets.
  const isolated = useMemo(() => (work && comps && chosen ? isolateComponent(work, comps.labels, chosen, 0) : null), [work, comps, chosen]);
  const aspect = isolated ? isolated.image.width / isolated.image.height : 1;

  useEffect(() => {
    if (step !== "clean" || !work || !canvasRef.current) return;
    scaleRef.current = paint(canvasRef.current, work, comps && chosen && pieceCount > 1 ? { labels: comps.labels, keep: chosen.id } : undefined);
  }, [step, work, comps, chosen, pieceCount]);

  const ref = REFERENCE_OBJECTS.find((r) => r.id === refId)!;
  const mmPerPx = refPts.length === 2 ? mmPerImagePx(refPts[0], refPts[1], ref.lengthMm) : null;

  useEffect(() => {
    if (step !== "size" || sizeMode !== "measure" || !original || !measureRef.current) return;
    const s = paint(measureRef.current, original);
    scaleRef.current = s;
    const ctx = measureRef.current.getContext("2d")!;
    ctx.strokeStyle = "#2F5BFF";
    ctx.fillStyle = "#2F5BFF";
    ctx.lineWidth = 2;
    refPts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * s, p.y * s, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    if (refPts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(refPts[0].x * s, refPts[0].y * s);
      ctx.lineTo(refPts[1].x * s, refPts[1].y * s);
      ctx.stroke();
    }
    if (isolated) {
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(isolated.crop.x * s, isolated.crop.y * s, isolated.crop.width * s, isolated.crop.height * s);
      ctx.setLineDash([]);
    }
  }, [step, sizeMode, original, refPts, isolated]);

  const toImg = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = e.currentTarget.width / r.width;
    return { x: ((e.clientX - r.left) * sx) / scaleRef.current, y: ((e.clientY - r.top) * sx) / scaleRef.current };
  };

  const applyBrush = useCallback(
    (p: Pt) => {
      if (!work || !original || tool === "none") return;
      brush(work, original, p.x, p.y, brushPx / scaleRef.current, tool);
      if (paintRaf.current) return;
      paintRaf.current = requestAnimationFrame(() => {
        paintRaf.current = 0;
        if (canvasRef.current) paint(canvasRef.current, work);
      });
    },
    [work, original, tool, brushPx],
  );

  // In measure mode the width follows the marked reference.
  const effectiveWidthMm = sizeMode === "measure" && mmPerPx && isolated ? isolated.image.width * mmPerPx : widthMm;
  const heightMm = effectiveWidthMm / aspect;
  /** The die-cut border adds to the artwork size; the result line shows the sticker as it will print. */
  const borderTotal = dieCut ? 2 * dieCutMm : 0;

  const finish = () => {
    if (!isolated) return;
    let img = isolated.image;
    const widthMm = effectiveWidthMm;
    const pxPerMm = img.width / widthMm;
    if (dieCut && dieCutMm > 0) img = addDieCutBorder(img, dieCutMm * pxPerMm);
    const asset: StickerAsset = {
      id: `up:${nanoid(10)}`,
      src: rgbaToPngDataUrl(img),
      pxWidth: img.width,
      pxHeight: img.height,
      // From the final pixels, so the artwork keeps exactly the px/mm the user set even after
      // the border radius was rounded to whole pixels.
      defaultWidthMm: img.width / pxPerMm,
      source: "upload",
    };
    onDone(asset, file?.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Sticker");
  };

  const endStroke = () => {
    if (!painting.current || !work) return;
    painting.current = false;
    setWork(clone(work)); // commit the stroke and recompute shapes
  };

  return (
    <Dialog open={!!file} onClose={onClose} title={t("title")} wide closeLabel={t("cancel")}>
      <ol className="mb-5 flex gap-2 text-sm" aria-label={t("title")}>
        {(["clean", "size"] as const).map((s, i) => (
          <li
            key={s}
            aria-current={step === s ? "step" : undefined}
            className="flex items-center gap-2 rounded-full px-3 py-1 text-muted aria-[current=step]:bg-ink aria-[current=step]:text-bg"
          >
            <span className="tabular-nums">{i + 1}</span>
            {s === "clean" ? t("stepClean") : t("stepSize")}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="rounded-lg bg-accent-soft p-3 text-sm">
          {t("error")}
        </p>
      )}
      {busy && <p className="text-sm text-muted">{t("processing")}</p>}

      {!error && work && step === "clean" && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <canvas
              ref={canvasRef}
              className={`mx-auto block max-w-full touch-none rounded-xl ${tool === "none" ? "cursor-pointer" : "cursor-crosshair"}`}
              onPointerDown={(e) => {
                const p = toImg(e);
                if (tool === "none") {
                  const id = comps?.labels[Math.floor(p.y) * work.width + Math.floor(p.x)];
                  if (id) setPick(id);
                  return;
                }
                e.currentTarget.setPointerCapture(e.pointerId);
                painting.current = true;
                applyBrush(p);
              }}
              onPointerMove={(e) => painting.current && applyBrush(toImg(e))}
              onPointerUp={endStroke}
              // A cancelled touch (system gesture, palm) still ends the stroke instead of leaving the brush down.
              onPointerCancel={endStroke}
              onLostPointerCapture={endStroke}
            />
            {pieceCount > 1 && (
              <p className="mt-3 text-center text-xs text-muted">
                {t("pieces", { count: pieceCount })} · {t("pickPiece")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <Toggle checked={bgOn} onChange={setBgOn} label={t("removeBg")} />
            {bgOn && (
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-muted">{t("tolerance")}</span>
                <input
                  type="range"
                  min={8}
                  max={120}
                  value={toleranceDraft}
                  onChange={(e) => setToleranceDraft(Number(e.target.value))}
                  onPointerUp={() => setTolerance(toleranceDraft)}
                  onKeyUp={() => setTolerance(toleranceDraft)}
                  onBlur={() => setTolerance(toleranceDraft)}
                  className="accent-[var(--accent)]"
                />
              </label>
            )}
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-muted">{t("brush")}</span>
              <Segmented
                label={t("brush")}
                value={tool}
                onChange={setTool}
                options={[
                  { value: "none", label: t("none") },
                  { value: "erase", label: t("erase") },
                  { value: "restore", label: t("restore") },
                ]}
              />
              {tool !== "none" && (
                <label className="mt-1 flex flex-col gap-2">
                  <span className="text-muted">{t("brushSize")}</span>
                  <input
                    type="range"
                    min={4}
                    max={60}
                    value={brushPx}
                    onChange={(e) => setBrushPx(Number(e.target.value))}
                    className="accent-[var(--accent)]"
                  />
                </label>
              )}
            </div>
            <Toggle checked={dieCut} onChange={setDieCut} label={t("dieCut")} />
            {dieCut && <NumberField label={t("dieCutWidth")} value={dieCutMm} onCommit={setDieCutMm} min={0.5} max={6} step={0.5} />}
            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button onClick={onClose}>{t("cancel")}</Button>
              <Button variant="dark" onClick={() => setStep("size")} disabled={!isolated}>
                {t("next")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!error && work && step === "size" && isolated && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">{t("sizeHow")}</p>
          <Segmented
            label={t("sizeHow")}
            value={sizeMode}
            onChange={(m) => {
              setSizeMode(m);
              setRefPts([]);
            }}
            options={[
              { value: "type", label: t("typeIt") },
              { value: "preset", label: t("preset") },
              { value: "measure", label: t("measure") },
            ]}
          />
          {sizeMode === "type" && (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <NumberField label={t("widthMm")} value={widthMm} onCommit={(v) => setWidthMm(v)} min={5} max={400} />
              <NumberField label={t("heightMm")} value={heightMm} onCommit={(v) => setWidthMm(v * aspect)} min={5} max={400} />
            </div>
          )}
          {sizeMode === "preset" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">{t("presetHint")}</span>
              <div className="flex flex-wrap gap-2">
                {SIZE_PRESETS_MM.map((p) => {
                  const w = aspect >= 1 ? p : p * aspect;
                  const active = Math.abs(widthMm - w) < 0.01;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setWidthMm(w)}
                      className="rounded-full border border-hairline px-4 py-2 text-sm tabular-nums aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
                    >
                      {p / 10} cm
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {sizeMode === "measure" && (
            <div className="flex flex-col gap-3">
              <label className="flex max-w-sm flex-col gap-1.5 text-sm">
                <span className="text-xs text-muted">{t("reference")}</span>
                <select
                  value={refId}
                  onChange={(e) => {
                    setRefId(e.target.value);
                    setRefPts([]);
                  }}
                  className="h-10 rounded-lg border border-hairline bg-bg px-3"
                >
                  {REFERENCE_OBJECTS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name[locale]} · {r.lengthMm} mm
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm">{mmPerPx ? t("markRefDone", { mm: mmPerPx.toFixed(3) }) : t("markRef", { name: ref.name[locale] })}</p>
              <p className="text-xs text-muted">{t("measureNote")}</p>
              <div>
                <canvas
                  ref={measureRef}
                  className="mx-auto block max-w-full cursor-crosshair touch-none rounded-xl"
                  onPointerDown={(e) => {
                    const p = toImg(e);
                    setRefPts((pts) => (pts.length >= 2 ? [p] : [...pts, p]));
                  }}
                />
              </div>
              {refPts.length > 0 && (
                <Button variant="ghost" onClick={() => setRefPts([])} className="self-start">
                  {t("resetPoints")}
                </Button>
              )}
            </div>
          )}
          <p className="text-base font-medium tabular-nums">
            {t("resultSize", { w: roundMm(effectiveWidthMm + borderTotal), h: roundMm(heightMm + borderTotal) })}
          </p>
          <div className="flex justify-between gap-2">
            <Button onClick={() => setStep("clean")}>{t("back")}</Button>
            <Button variant="primary" onClick={finish} disabled={sizeMode === "measure" && !mmPerPx}>
              {t("add")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
