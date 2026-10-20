import { useId } from "react";
import { LazySvgLayer } from "@/components/LazySvgLayer";
import { DEMO_ASSETS, LOGO_PATH, logoTransform } from "@/config/demo";
import type { LogoFinish } from "@/config/laptops";
import { GLOSS_DIR, lidLighting, type Linear, type Radial } from "@/lib/lighting";
import { VISIBLE_LIBRARY, stickerSrc } from "@/stickers/library";

export type LogoBox = { x: number; y: number; width: number; height: number };

const useSvgId = () => useId().replace(/:/g, "");

function LinearDef({ id, g }: { id: string; g: Linear }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={g.start.x} y1={g.start.y} x2={g.end.x} y2={g.end.y}>
      {g.stops.map(([o, c], i) => (
        <stop key={i} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
}

function RadialDef({ id, g }: { id: string; g: Radial }) {
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={g.center.x} cy={g.center.y} r={g.radius}>
      {g.stops.map(([o, c], i) => (
        <stop key={i} offset={o} stopColor={c} />
      ))}
    </radialGradient>
  );
}

/** Lit lid face: aluminium falloff, specular hotspot, and a light sweep that runs on hover (`.group`). */
export function LidSurface({ widthMm, heightMm, radiusMm, color }: { widthMm: number; heightMm: number; radiusMm: number; color: string }) {
  const id = useSvgId();
  const light = lidLighting(color, { widthMm, heightMm });
  // The sweep is a band parallel to the logo's reflection edge, travelling along the same gloss axis
  // from beyond one corner to beyond the opposite one.
  const c = { x: widthMm / 2, y: heightMm / 2 };
  const band = Math.min(widthMm, heightMm) * 0.22;
  const travel = (widthMm * Math.abs(GLOSS_DIR.x) + heightMm * Math.abs(GLOSS_DIR.y)) / 2 + band;
  const sweepVars = {
    "--sweep-from-x": `${-GLOSS_DIR.x * travel}px`,
    "--sweep-from-y": `${-GLOSS_DIR.y * travel}px`,
    "--sweep-to-x": `${GLOSS_DIR.x * travel}px`,
    "--sweep-to-y": `${GLOSS_DIR.y * travel}px`,
  } as React.CSSProperties;
  return (
    <>
      <defs>
        <LinearDef id={`base${id}`} g={light.base} />
        <RadialDef id={`spec${id}`} g={light.specular} />
        <linearGradient
          id={`sweep${id}`}
          gradientUnits="userSpaceOnUse"
          x1={c.x - GLOSS_DIR.x * band}
          y1={c.y - GLOSS_DIR.y * band}
          x2={c.x + GLOSS_DIR.x * band}
          y2={c.y + GLOSS_DIR.y * band}
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity={light.dark ? 0.16 : 0.38} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`clip${id}`}>
          <rect width={widthMm} height={heightMm} rx={radiusMm} />
        </clipPath>
      </defs>
      <rect width={widthMm} height={heightMm} rx={radiusMm} fill={`url(#base${id})`} />
      <rect width={widthMm} height={heightMm} rx={radiusMm} fill={`url(#spec${id})`} />
      <rect x={0.3} y={0.3} width={widthMm - 0.6} height={heightMm - 0.6} rx={radiusMm} fill="none" stroke={light.rim} strokeWidth={0.6} />
      <g clipPath={`url(#clip${id})`}>
        <rect className="lid-sweep" style={sweepVars} x={-widthMm} y={-heightMm} width={widthMm * 3} height={heightMm * 3} fill={`url(#sweep${id})`} />
      </g>
    </>
  );
}

/** Demo-only mirror-finish logo, fitted into the model's logo box (mm). Renders nothing unless demo assets are on. */
export function LogoMark({ logo, lidColor, finish = "gloss-black" }: { logo: LogoBox; lidColor: string; finish?: LogoFinish }) {
  const id = useSvgId();
  if (!DEMO_ASSETS) return null;
  const t = logoTransform(logo);
  const light = lidLighting(lidColor, { widthMm: 24, heightMm: 24 }, undefined, finish);
  const mirror = finish === "mirror-light";
  return (
    <g transform={`translate(${t.x} ${t.y}) scale(${t.scale})`}>
      <defs>
        <LinearDef id={`logo${id}`} g={light.logo} />
      </defs>
      {/* A hairline offset gives the polished inlay a lip catching the light. */}
      <path
        d={LOGO_PATH}
        fill={mirror || light.dark ? "#000" : "#fff"}
        opacity={mirror ? 0.16 : light.dark ? 0.3 : 0.55}
        transform={`translate(0 ${mirror ? 0.14 : light.dark ? -0.12 : 0.16})`}
      />
      <path d={LOGO_PATH} fill={`url(#logo${id})`} />
    </g>
  );
}

export type ArtSticker = { id: string; x: number; y: number; w?: number; r?: number };

const byId = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));

/**
 * A laptop lid drawn in true proportions: the SVG viewBox is in millimetres, so stickers and
 * lid share one physical scale no matter how large the illustration renders.
 * `lazy` holds back the sticker images until the lid is near the viewport (the lid itself still renders).
 */
export function LidArt({
  widthMm,
  heightMm,
  radiusMm = 10,
  color,
  stickers,
  className,
  title,
  logo,
  logoFinish = "gloss-black",
  lazy = false,
}: {
  lazy?: boolean;
  logo?: LogoBox;
  logoFinish?: LogoFinish;
  widthMm: number;
  heightMm: number;
  radiusMm?: number;
  color: string;
  stickers: ArtSticker[];
  className?: string;
  title?: string;
}) {
  const uid = useSvgId();
  const layer = stickers.map((s, i) => {
    const def = byId.get(s.id);
    if (!def) return null;
    const w = s.w ?? def.widthMm;
    const h = (w * def.viewBox[1]) / def.viewBox[0];
    return (
      <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r ?? 0})`}>
        <image href={stickerSrc(def)} x={-w / 2} y={-h / 2} width={w} height={h} />
      </g>
    );
  });
  return (
    <svg
      viewBox={`0 0 ${widthMm} ${heightMm}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <filter id={`shadow${uid}`} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.7" floodOpacity="0.22" />
        </filter>
      </defs>
      <LidSurface widthMm={widthMm} heightMm={heightMm} radiusMm={radiusMm} color={color} />
      {logo && <LogoMark logo={logo} lidColor={color} finish={logoFinish} />}
      {/* One shadow filter for the whole sticker layer instead of one per sticker. */}
      <g filter={`url(#shadow${uid})`}>{lazy ? <LazySvgLayer>{layer}</LazySvgLayer> : layer}</g>
    </svg>
  );
}
