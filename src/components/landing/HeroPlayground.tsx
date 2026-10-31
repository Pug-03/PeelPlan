"use client";

import { Shuffle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { LidSurface, LogoMark, type ArtSticker } from "@/components/LidArt";
import { LAPTOP_MODELS, getLaptopModel, lidGeometry } from "@/config/laptops";
import { VISIBLE_LIBRARY, stickerSrc, type LibrarySticker } from "@/stickers/library";

/**
 * Hero lid you can play with: drag stickers, double-click to peel one off, shuffle a new set,
 * and switch MacBook models to watch the lid change size while the stickers stay true to scale.
 * Some stickers are holographic and shimmer with the pointer.
 */

type Placed = { key: string; id: string; dx: number; dy: number; w: number; r: number; holo: boolean; delay: number };
type Geo = { w: number; h: number; radius: number; logo: { x: number; y: number; width: number; height: number } };

const byId = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));
const MAX_W = Math.max(...LAPTOP_MODELS.map((m) => m.lid.widthMm.value));
const MAX_H = Math.max(...LAPTOP_MODELS.map((m) => m.lid.heightMm.value));
/** Room around the largest lid for the dimension lines. */
const PAD_X = 26;
const PAD_TOP = 22;
const PAD_BOTTOM = 8;
const VB_W = MAX_W + PAD_X * 2;
const VB_H = MAX_H + PAD_TOP + PAD_BOTTOM;
const CX = VB_W / 2;
const CY = PAD_TOP + MAX_H / 2;

const geoOf = (modelId: string): Geo => {
  const g = lidGeometry(getLaptopModel(modelId));
  return { w: g.widthMm, h: g.heightMm, radius: g.cornerRadiusMm, logo: g.logo };
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpGeo = (a: Geo, b: Geo, t: number): Geo => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  radius: lerp(a.radius, b.radius, t),
  logo: {
    x: lerp(a.logo.x, b.logo.x, t),
    y: lerp(a.logo.y, b.logo.y, t),
    width: lerp(a.logo.width, b.logo.width, t),
    height: lerp(a.logo.height, b.logo.height, t),
  },
});
const heightOf = (def: LibrarySticker, w: number) => (w * def.viewBox[1]) / def.viewBox[0];

/** Stickers the shuffle draws from: the coding set first, everything visible as a fallback. */
const POOL = (() => {
  const coding = VISIBLE_LIBRARY.filter((s) => s.category === "coding");
  return coding.length >= 6 ? coding : VISIBLE_LIBRARY;
})();

/** A fresh, roughly gridded set that fits the smallest lid. */
function shuffled(seed: number): Placed[] {
  let h = seed * 2654435761;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
  const picks = [...POOL].sort(() => rnd() - 0.5).slice(0, 6);
  const cells = [
    [-92, -48],
    [0, -52],
    [92, -46],
    [-90, 50],
    [2, 54],
    [92, 48],
  ];
  const holo = new Set([Math.floor(rnd() * 6), Math.floor(rnd() * 6)]);
  return picks.map((def, i) => {
    const w = Math.min(Math.max(def.widthMm, 34), 66);
    return {
      key: `${seed}-${i}`,
      id: def.id,
      dx: cells[i][0] + (rnd() - 0.5) * 16,
      dy: cells[i][1] + (rnd() - 0.5) * 12,
      w,
      r: (rnd() - 0.5) * 20,
      holo: holo.has(i),
      delay: i * 70,
    };
  });
}

export function HeroPlayground({ initial, initialModelId, initialColor }: { initial: ArtSticker[]; initialModelId: string; initialColor: string }) {
  const t = useTranslations("landing");
  const locale = useLocale() as "th" | "en";
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const holoRef = useRef<SVGLinearGradientElement>(null);

  const [modelId, setModelId] = useState(initialModelId);
  const model = getLaptopModel(modelId);
  const [colorHex, setColorHex] = useState(initialColor);
  const color = model.colors.find((c) => c.hex === colorHex)?.hex ?? model.colors[0].hex;

  // Stickers are placed relative to the lid centre, so they stay put while the lid resizes.
  const [stickers, setStickers] = useState<Placed[]>(() => {
    const base = geoOf(initialModelId);
    return initial.flatMap((s, i) => {
      const def = byId.get(s.id);
      if (!def) return [];
      return [{ key: `i-${i}`, id: s.id, dx: s.x - base.w / 2, dy: s.y - base.h / 2, w: s.w ?? def.widthMm, r: s.r ?? 0, holo: i === 4 || i === 1, delay: 0 }];
    });
  });
  const [peeling, setPeeling] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const seed = useRef(1);

  /* ---------- Lid size tween ---------- */
  const [geo, setGeo] = useState<Geo>(() => geoOf(initialModelId));
  const geoNow = useRef(geo);
  useEffect(() => {
    const from = geoNow.current;
    const to = geoOf(modelId);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = duration ? Math.min(1, (now - start) / duration) : 1;
      // Ease out with a little overshoot, like a sheet settling.
      const e = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
      const g = lerpGeo(from, to, e);
      geoNow.current = g;
      setGeo(g);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [modelId]);

  /* ---------- Holographic shimmer follows the pointer ---------- */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let x = 0.5;
    let y = 0.5;
    const apply = () => {
      raf = 0;
      holoRef.current?.setAttribute("gradientTransform", `rotate(${-30 + x * 60} ${CX} ${CY}) translate(${(x - 0.5) * 160} ${(y - 0.5) * 90})`);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX / window.innerWidth;
      y = e.clientY / window.innerHeight;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    // Touch screens get a slow drift instead.
    const drift = window.matchMedia("(hover: none)").matches
      ? window.setInterval(() => {
          const s = performance.now() / 2600;
          x = 0.5 + Math.sin(s) * 0.45;
          y = 0.5 + Math.cos(s * 0.8) * 0.4;
          if (!raf) raf = requestAnimationFrame(apply);
        }, 50)
      : 0;
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      window.clearInterval(drift);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ---------- Dragging ---------- */
  const drag = useRef<{ key: string; sx: number; sy: number; dx: number; dy: number; moved: boolean } | null>(null);
  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : pt;
  };
  const onDown = (e: React.PointerEvent, s: Placed) => {
    if (e.button !== 0) return;
    const p = toSvg(e);
    drag.current = { key: s.key, sx: p.x, sy: p.y, dx: s.dx, dy: s.dy, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(s.key);
    // Bring the picked sticker to the top.
    setStickers((list) => [...list.filter((x) => x.key !== s.key), { ...s, delay: 0 }]);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e);
    const g = geoNow.current;
    const nx = Math.max(-g.w / 2, Math.min(g.w / 2, d.dx + p.x - d.sx));
    const ny = Math.max(-g.h / 2, Math.min(g.h / 2, d.dy + p.y - d.sy));
    if (Math.abs(p.x - d.sx) + Math.abs(p.y - d.sy) > 1) d.moved = true;
    setStickers((list) => list.map((x) => (x.key === d.key ? { ...x, dx: nx, dy: ny } : x)));
  };
  const onUp = () => {
    drag.current = null;
    setDragging(null);
  };

  const peel = useCallback((key: string) => {
    setPeeling(key);
    window.setTimeout(() => {
      setStickers((list) => list.filter((x) => x.key !== key));
      setPeeling(null);
    }, 480);
  }, []);
  const shuffle = () => setStickers(shuffled(++seed.current));

  const lidX = CX - geo.w / 2;
  const lidY = CY - geo.h / 2;
  const target = geoOf(modelId);
  // "MacBook Pro 14\" PROLED" → "PROLED 14\"" so all seven pills fit one row on a desktop hero.
  const shortName = (name: string) => name.replace(/^MacBook\s+/, "").replace(/^Pro (\S+) PROLED$/, "PROLED $1");

  const holoStops = useMemo(
    () => ["#ff6bd6", "#ffd36b", "#7cff9b", "#6bd8ff", "#a77bff", "#ff6bd6"].map((c, i, a) => <stop key={i} offset={i / (a.length - 1)} stopColor={c} />),
    [],
  );

  return (
    <div className="flex flex-col gap-3 select-none">
      <div className="hp-tilt select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full overflow-visible drop-shadow-[0_24px_40px_rgb(0_0_0/0.3)]"
          role="img"
          aria-label={t("heroLidLabel")}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <defs>
            <clipPath id={`lid${uid}`}>
              <rect x={lidX} y={lidY} width={geo.w} height={geo.h} rx={geo.radius} />
            </clipPath>
            <linearGradient ref={holoRef} id={`holo${uid}`} gradientUnits="userSpaceOnUse" x1={CX - 70} y1={0} x2={CX + 70} y2={0} spreadMethod="repeat">
              {holoStops}
            </linearGradient>
          </defs>

          {/* Dimension lines, in real millimetres */}
          <g className="text-muted" fill="currentColor" stroke="currentColor" fontSize="7" fontFamily="var(--font-sans)">
            <path d={`M${lidX} ${lidY - 9}h${geo.w}M${lidX} ${lidY - 12}v6M${lidX + geo.w} ${lidY - 12}v6`} strokeWidth="0.5" fill="none" opacity=".6" />
            <text x={CX} y={lidY - 12.5} textAnchor="middle" stroke="none" className="tabular-nums">
              {geo.w.toFixed(1)} mm
            </text>
            <path d={`M${lidX - 9} ${lidY}v${geo.h}M${lidX - 12} ${lidY}h6M${lidX - 12} ${lidY + geo.h}h6`} strokeWidth="0.5" fill="none" opacity=".6" />
            <text x={lidX - 12.5} y={CY} textAnchor="middle" stroke="none" transform={`rotate(-90 ${lidX - 12.5} ${CY})`} className="tabular-nums">
              {geo.h.toFixed(1)} mm
            </text>
          </g>

          <g transform={`translate(${lidX} ${lidY})`}>
            <LidSurface widthMm={geo.w} heightMm={geo.h} radiusMm={geo.radius} color={color} />
            <LogoMark logo={geo.logo} lidColor={color} finish={model.logoFinish} />
          </g>

          <g clipPath={`url(#lid${uid})`}>
            {stickers.map((s) => {
              const def = byId.get(s.id);
              if (!def) return null;
              const h = heightOf(def, s.w);
              const src = stickerSrc(def);
              const cls = ["hp-sticker", dragging === s.key && "is-dragging", peeling === s.key && "is-peeling", s.delay > 0 && "is-new"]
                .filter(Boolean)
                .join(" ");
              return (
                <g key={s.key} transform={`translate(${CX + s.dx} ${CY + s.dy}) rotate(${s.r})`}>
                  <g
                    className={cls}
                    style={{ "--d": `${s.delay}ms` } as React.CSSProperties}
                    onPointerDown={(e) => onDown(e, s)}
                    onDoubleClick={() => peel(s.key)}
                  >
                    <image href={src} x={-s.w / 2} y={-h / 2} width={s.w} height={h} />
                    {s.holo && (
                      <>
                        <mask id={`m${uid}${s.key}`} style={{ maskType: "alpha" }}>
                          <image href={src} x={-s.w / 2} y={-h / 2} width={s.w} height={h} />
                        </mask>
                        <rect className="hp-holo" x={-s.w / 2} y={-h / 2} width={s.w} height={h} fill={`url(#holo${uid})`} mask={`url(#m${uid}${s.key})`} />
                      </>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Controls */}
      <div className="flex min-w-0 flex-col gap-2.5 px-1 sm:px-4">
        {/* One row at every width: min-w-0 lets it scroll sideways instead of wrapping or widening the hero column. */}
        <div
          className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
          role="group"
          aria-label={t("playModels")}
        >
          {LAPTOP_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === modelId}
              onClick={() => setModelId(m.id)}
              className="rounded-full border border-hairline px-2.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg sm:py-1.5"
            >
              {shortName(m.name)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" role="group" aria-label={t("playColors")}>
            {model.colors.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.hex === color}
                aria-label={c.name[locale]}
                title={c.name[locale]}
                onClick={() => setColorHex(c.hex)}
                className="relative size-6 rounded-full border border-black/15 ring-offset-2 ring-offset-bg transition-shadow after:absolute after:-inset-2.5 after:rounded-full aria-pressed:ring-2 aria-pressed:ring-ink"
                style={{ background: c.hex }}
              />
            ))}
            <span className="ml-1 text-xs text-muted tabular-nums">{t("playSize", { w: target.w.toFixed(1), h: target.h.toFixed(1) })}</span>
          </div>
          <button
            type="button"
            onClick={shuffle}
            className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-hairline"
          >
            <Shuffle className="size-4" strokeWidth={2} aria-hidden="true" />
            {t("playShuffle")}
          </button>
        </div>
        <p className="hidden text-xs text-muted sm:block">{t("playHint")}</p>
      </div>
    </div>
  );
}
