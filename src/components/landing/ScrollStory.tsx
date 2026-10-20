"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { ID1_CARD_MM } from "@/lib/scale";
import { LazySvgLayer } from "@/components/LazySvgLayer";
import { LidSurface, LogoMark } from "@/components/LidArt";
import { VISIBLE_LIBRARY, stickerSrc } from "@/stickers/library";

const model = getLaptopModel("macbook-pro-14-m5");
const lid = lidGeometry(model);
const PAD = 22;
const VB_W = lid.widthMm + PAD * 2;
const VB_H = lid.heightMm + PAD * 2;

const STICKERS = [
  { id: "mango-sticky", x: 72, y: 62, r: -8 },
  { id: "peel-star", x: 238, y: 54, w: 46, r: 12 },
  { id: "elephant", x: 222, y: 158, r: 4 },
  { id: "boba", x: 64, y: 156, r: -6 },
  { id: "lightning", x: 150, y: 172, w: 26, r: 18 },
];
/** Step opacity by distance from the active step; the nearest neighbour stays readable. */
const STEP_LEVELS = [1, 0.62, 0.4, 0.26];

const byId = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));

export function ScrollStory({ title, steps, svgLabel }: { title: React.ReactNode; steps: string[]; svgLabel: string }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const outline = q("[data-outline]")[0] as unknown as SVGRectElement | undefined;
      // A little longer than the path so the dash's two ends overlap instead of leaving a hairline seam.
      const len = (outline?.getTotalLength?.() ?? 1200) + 4;
      // Hidden until it starts drawing: a zero-length dash still paints a 1px dot at the path start.
      gsap.set(outline!, { strokeDasharray: `${len} ${len}`, strokeDashoffset: len, opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      // 1 — lid draws, measurements appear.
      tl.to(outline!, { opacity: 1, duration: 0.05 })
        .to(outline!, { strokeDashoffset: 0, duration: 1 }, "<")
        .set(outline!, { strokeDasharray: "none" }) // fully drawn: plain solid stroke, no dash join at all
        .to(q("[data-lid-fill]"), { opacity: 1, duration: 0.5 }, "<0.6")
        .from(q("[data-dim]"), { opacity: 0, y: 4, stagger: 0.1, duration: 0.4 }, "<")
        // 2 — card calibrates.
        .addLabel("s1", "+=0.4")
        .fromTo(q("[data-card]"), { opacity: 0, x: -60, rotate: -8 }, { opacity: 1, x: 0, rotate: 0, duration: 0.8 }, "<")
        .to(q("[data-card-check]"), { opacity: 1, duration: 0.3 })
        .to(q("[data-card]"), { opacity: 0, y: -30, duration: 0.5 }, "+=0.4")
        // 3 — stickers drop in at real size.
        .addLabel("s2", "<")
        // Animate the transform *attribute*: each sticker group's own 0,0 is its centre, so the drop lands
        // exactly on its outline. (CSS/GSAP origins resolve against the bbox or the whole SVG and drift.)
        .fromTo(
          q("[data-sticker]"),
          { opacity: 0, attr: { transform: "translate(0 -14) scale(1.25)" } },
          { opacity: 1, attr: { transform: "translate(0 0) scale(1)" }, stagger: 0.28, duration: 0.5, ease: "back.out(1.6)" },
          "<",
        )
        // 4 — the print guide overlays.
        .addLabel("s3", "+=0.3")
        // Anchor to the label: "<" would point back at the sticker drop, ending the timeline before step 4.
        .fromTo(q("[data-guide]"), { opacity: 0 }, { opacity: 1, stagger: 0.08, duration: 0.4 }, "s3")
        .to(q("[data-paper]"), { opacity: 1, duration: 0.6 }, "s3")
        // A short hold so step 4 stays lit before the section scrolls away.
        .to({}, { duration: 0.4 });

      // Steps fade by distance from the active one, so the list reads as a gradient rather than on/off.
      const items = q("[data-step]") as HTMLElement[];
      let shown = -1;
      const focus = (k: number) => {
        if (k === shown) return;
        shown = k;
        items.forEach((li, i) => {
          li.dataset.active = String(i === k);
          li.style.opacity = String(STEP_LEVELS[Math.min(Math.abs(i - k), STEP_LEVELS.length - 1)]);
        });
      };
      tl.eventCallback("onUpdate", () => {
        const t = tl.time();
        focus(t >= tl.labels.s3 ? 3 : t >= tl.labels.s2 ? 2 : t >= tl.labels.s1 ? 1 : 0);
      });

      if (reduce) {
        tl.progress(1);
        gsap.set(q("[data-step]"), { opacity: 1 });
        gsap.set(q("[data-card]"), { opacity: 0 });
        return;
      }
      // Start while the section is still coming up, so the lid is already drawing by the time the panel
      // pins; starting at "top top" left a blank frame (centred title, invisible lid) below the marquee.
      ScrollTrigger.create({ trigger: el, start: "top center", end: "bottom bottom", scrub: 0.6, animation: tl });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative h-[240vh] motion-reduce:h-auto md:h-[420vh]" aria-labelledby="story-title">
      <div className="sticky top-0 flex min-h-dvh items-center motion-reduce:static motion-reduce:py-24">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-5 sm:gap-10 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <h2 id="story-title" className="text-balance text-[clamp(2.25rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
              {title}
            </h2>
            <ol className="mt-6 space-y-3 sm:mt-10 sm:space-y-5">
              {steps.map((s, i) => (
                <li
                  key={i}
                  data-step={i}
                  data-active={i === 0}
                  className="story-step flex gap-4 leading-relaxed sm:text-[1.05rem]"
                  style={{ opacity: STEP_LEVELS[Math.min(i, STEP_LEVELS.length - 1)] }}
                >
                  <span className="story-badge mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-hairline text-xs tabular-nums text-muted">
                    {i + 1}
                  </span>
                  <span className="max-w-[38ch]">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative">
            {/* Capped on phones so the stacked panel still fits one screen while it is pinned. */}
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto max-h-[40dvh] w-full overflow-visible lg:max-h-none" role="img" aria-label={svgLabel}>
              <defs>
                <filter id="story-shadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="0.8" stdDeviation="0.9" floodOpacity="0.25" />
                </filter>
                <pattern id="story-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M10 0H0V10" fill="none" stroke="var(--hairline)" strokeWidth="0.25" />
                </pattern>
              </defs>
              <rect data-paper x="4" y="4" width={VB_W - 8} height={VB_H - 8} rx="3" fill="url(#story-grid)" opacity="0" />
              <g transform={`translate(${PAD} ${PAD})`}>
                {/* Space black on the light page, silver in dark mode so the lid stands off the dark background. */}
                {(["#2B2B2D", "#D9DADC"] as const).map((c, k) => (
                  <g key={c} className={k ? "hidden dark:inline" : "dark:hidden"}>
                    <g data-lid-fill opacity="0">
                      <LidSurface widthMm={lid.widthMm} heightMm={lid.heightMm} radiusMm={lid.cornerRadiusMm} color={c} />
                    </g>
                    <g data-lid-fill opacity="0">
                      <LogoMark logo={lid.logo} lidColor={c} finish={model.logoFinish} />
                    </g>
                  </g>
                ))}
                <rect data-outline width={lid.widthMm} height={lid.heightMm} rx={lid.cornerRadiusMm} fill="none" stroke="var(--text)" strokeWidth="0.8" />
                <g data-dim fill="var(--muted)" fontSize="6.5" fontFamily="var(--font-sans)">
                  <path d={`M0 -8H${lid.widthMm}M0 -11V-5M${lid.widthMm} -11V-5`} stroke="var(--muted)" strokeWidth="0.4" />
                  <text x={lid.widthMm / 2} y="-11" textAnchor="middle" className="tabular-nums">
                    {lid.widthMm} mm
                  </text>
                </g>
                <g data-dim fill="var(--muted)" fontSize="6.5" fontFamily="var(--font-sans)">
                  <path d={`M-8 0V${lid.heightMm}M-11 0H-5M-11 ${lid.heightMm}H-5`} stroke="var(--muted)" strokeWidth="0.4" />
                  <text x="-11" y={lid.heightMm / 2} textAnchor="middle" transform={`rotate(-90 -11 ${lid.heightMm / 2})`} dy="-2">
                    {lid.heightMm} mm
                  </text>
                </g>

                {STICKERS.map((s, i) => {
                  const def = byId.get(s.id)!;
                  const w = s.w ?? def.widthMm;
                  const h = (w * def.viewBox[1]) / def.viewBox[0];
                  return (
                    <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r})`}>
                      <g data-sticker style={{ opacity: 0 }} transform="translate(0 0) scale(1)" filter="url(#story-shadow)">
                        <LazySvgLayer>
                          <image href={stickerSrc(def)} x={-w / 2} y={-h / 2} width={w} height={h} />
                        </LazySvgLayer>
                      </g>
                      <g data-guide style={{ opacity: 0 }}>
                        <rect
                          x={-w / 2 - 1.5}
                          y={-h / 2 - 1.5}
                          width={w + 3}
                          height={h + 3}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="0.6"
                          strokeDasharray="2.4 1.6"
                        />
                        <path d="M-3 0H3M0 -3V3" stroke="var(--accent)" strokeWidth="0.5" />
                      </g>
                    </g>
                  );
                })}

                {/* Outer group positions; GSAP animates the inner group's own transform. */}
                <g transform={`translate(${lid.widthMm / 2 - ID1_CARD_MM.width / 2} ${lid.heightMm / 2 - ID1_CARD_MM.height / 2})`}>
                  <g data-card style={{ opacity: 0 }}>
                    <rect width={ID1_CARD_MM.width} height={ID1_CARD_MM.height} rx="3.2" fill="var(--bg)" stroke="var(--accent)" strokeWidth="0.9" />
                    <rect x="7" y="14" width="12" height="9" rx="1.5" fill="var(--hairline)" />
                    <text
                      x={ID1_CARD_MM.width / 2}
                      y={ID1_CARD_MM.height - 9}
                      textAnchor="middle"
                      fontSize="5.5"
                      fill="var(--muted)"
                      fontFamily="var(--font-sans)"
                    >
                      85.60 × 53.98 mm
                    </text>
                    <g data-card-check style={{ opacity: 0 }}>
                      <circle cx={ID1_CARD_MM.width - 12} cy="14" r="6" fill="var(--accent)" />
                      <path
                        d={`M${ID1_CARD_MM.width - 15} 14l2.2 2.2 4-4.4`}
                        fill="none"
                        stroke="var(--accent-ink)"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  </g>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
