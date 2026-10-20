import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { VISIBLE_LIBRARY } from "@/stickers/library";

/**
 * Social share card (Open Graph / X), 1200 × 630: wordmark and headline on the left, a silver
 * MacBook lid with a few in-house stickers on it at true relative size on the right.
 * Rendered by satori at build time, so the Thai font ships with the repo (Anuphan, OFL).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "PeelPlan: see it at actual size before you stick / เห็นขนาดจริง ก่อนติดจริง";

const INK = "#1B1B1F";
const LIME = "#D7FF3A";

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// RulerMark from components/Wordmark.tsx, as a standalone SVG.
const MARK = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<path d="M27.6 19.1A12 12 0 1 1 19.1 4.4Z" fill="${LIME}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M19.1 4.4Q18.4 16.8 27.6 19.1Z" fill="#000" opacity=".18" transform="translate(-.6 1)"/>` +
    `<path d="M19.1 4.4Q18.4 16.8 27.6 19.1Z" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `</svg>`,
);

const LID = lidGeometry(getLaptopModel("macbook-pro-14-m5"));
const LID_W = 560;
const PX_PER_MM = LID_W / LID.widthMm;
const LID_H = Math.round(LID.heightMm * PX_PER_MM);

/** Placement on the lid in mm (centre), like the landing layouts. Art without text only: satori's SVG renderer has no fonts. */
const STICKERS = [
  { id: "peel-star", x: 58, y: 54, r: -8 },
  { id: "mango-sticky", x: 150, y: 76, r: 5 },
  { id: "tiny-planet", x: 262, y: 48, r: 10 },
  { id: "boba", x: 80, y: 166, r: -5 },
  { id: "smile-blob", x: 178, y: 160, r: 7 },
  { id: "lightning", x: 262, y: 170, r: 14 },
].flatMap((s) => {
  const def = VISIBLE_LIBRARY.find((d) => d.id === s.id);
  if (!def?.svg) return [];
  const w = def.widthMm * PX_PER_MM;
  const h = (w * def.viewBox[1]) / def.viewBox[0];
  return [{ ...s, src: svgUri(def.svg), w, h }];
});

const fonts = Promise.all((["Medium", "Bold"] as const).map((w) => readFile(join(process.cwd(), "src/app/[locale]/_og", `Anuphan-${w}.ttf`))));

export async function shareImage(locale: string) {
  const t = await getTranslations({ locale, namespace: "meta" });
  const [medium, bold] = await fonts;
  const th = locale === "th";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: "#FAFAF7",
        color: INK,
        fontFamily: "Anuphan",
        padding: "0 64px 0 72px",
      }}
    >
      {/* Copy */}
      <div style={{ display: "flex", flexDirection: "column", width: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK} width={52} height={52} alt="" />
          <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1 }}>PeelPlan</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: th ? 70 : 64,
            fontWeight: 700,
            lineHeight: th ? 1.25 : 1.05,
            letterSpacing: th ? 0 : -2,
          }}
        >
          {t("ogHeadline")}
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 25, fontWeight: 500, lineHeight: 1.45, color: "#5B5B63" }}>{t("ogSub")}</div>
        <div style={{ display: "flex", marginTop: 38 }}>
          <span style={{ display: "flex", background: LIME, borderRadius: 999, padding: "10px 24px", fontSize: 24, fontWeight: 700 }}>1:1 · ±1 mm</span>
        </div>
      </div>

      {/* Lid */}
      <div style={{ display: "flex", flex: 1, justifyContent: "flex-end" }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: LID_W,
            height: LID_H,
            borderRadius: LID.cornerRadiusMm * PX_PER_MM,
            backgroundImage: "linear-gradient(135deg, #EEEFF1 0%, #D6D7DA 45%, #C4C5C9 100%)",
            border: "1px solid #B9BABE",
            boxShadow: "0 30px 60px rgba(0,0,0,0.18), 0 6px 14px rgba(0,0,0,0.10)",
            transform: "rotate(-3deg)",
          }}
        >
          {STICKERS.map((s) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={s.src}
              width={s.w}
              height={s.h}
              alt=""
              style={{
                position: "absolute",
                left: s.x * PX_PER_MM - s.w / 2,
                top: s.y * PX_PER_MM - s.h / 2,
                transform: `rotate(${s.r}deg)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Anuphan", data: medium, weight: 500, style: "normal" },
        { name: "Anuphan", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
