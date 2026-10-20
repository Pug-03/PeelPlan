"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LidArt, type ArtSticker } from "@/components/LidArt";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { Link } from "@/i18n/navigation";
import { VISIBLE_LIBRARY, stickerSrc } from "@/stickers/library";

/**
 * Closing scene, pinned: a sticker sitting on the lid at real size grows until it breaks out of
 * the lid's frame and over the huge type, then the call to action arrives.
 */

const MODEL = getLaptopModel("macbook-pro-14-m5");
const LID = lidGeometry(MODEL);
const HERO = { id: "code-coder", x: 152, y: 172, w: 64 };
/** In-house vector stickers (crisp at any size), roughly square-ish so they read big. One is picked per visit. */
const HERO_POOL = VISIBLE_LIBRARY.filter((s) => {
  const a = s.viewBox[1] / s.viewBox[0];
  return s.svg && !s.demo && !s.id.startsWith("lang-") && a > 0.45 && a < 1.6;
});
const AROUND: ArtSticker[] = [
  { id: "peel-star", x: 58, y: 52, r: -8 },
  { id: "lightning", x: 250, y: 52, r: 8 },
  { id: "boba", x: 62, y: 165, r: 6 },
  { id: "code-key-copy", x: 256, y: 168, w: 32, r: -6 },
];

let picked: string | undefined;
/** One random pick per page load, stable across re-renders. */
const visitHero = () => (picked ??= HERO_POOL.length ? HERO_POOL[Math.floor(Math.random() * HERO_POOL.length)].id : HERO.id);
const noSubscribe = () => () => {};

/** What a click slaps onto the page. */
const SLAP_POOL = [
  "peel-star",
  "boba",
  "smile-blob",
  "code-coder",
  "code-key-copy",
  "code-sym-braces",
  "mushroom",
  "lightning",
  "tiny-planet",
  "code-say-lgtm",
];

export function BreakFrame({
  lineA,
  lineB,
  mark,
  cta,
  sub,
  slapHint,
}: {
  lineA: string;
  lineB: string;
  mark: string;
  cta: string;
  sub: string;
  slapHint: string;
}) {
  const root = useRef<HTMLElement>(null);
  const [slaps, setSlaps] = useState<{ key: number; src: string; x: number; y: number; r: number; w: number }[]>([]);
  const slapCount = useRef(0);
  const slap = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const n = slapCount.current++;
    const def = VISIBLE_LIBRARY.find((s) => s.id === SLAP_POOL[n % SLAP_POOL.length]);
    if (!def) return;
    setSlaps((list) => [
      ...list.slice(-13),
      { key: n, src: stickerSrc(def), x: e.clientX - r.left, y: e.clientY - r.top, r: ((n * 37) % 40) - 20, w: 90 + ((n * 53) % 60) },
    ]);
  };
  // The server renders the default; the visit's random pick swaps in on the client (no hydration mismatch).
  const heroId = useSyncExternalStore(noSubscribe, visitHero, () => HERO.id);
  const hero = useMemo(() => VISIBLE_LIBRARY.find((s) => s.id === heroId) ?? VISIBLE_LIBRARY[0], [heroId]);
  const aspect = hero.viewBox[1] / hero.viewBox[0];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", still: "(prefers-reduced-motion: reduce)" }, (ctx) => {
      const q = gsap.utils.selector(el);
      const lid = q("[data-lid]")[0] as HTMLElement;
      const big = q("[data-big]")[0] as HTMLElement;
      const stage = q("[data-stage]")[0] as HTMLElement;
      // Start exactly on its spot on the lid, at real size. Offsets are summed up to the stage because
      // the scaled lid wrapper becomes the lid's offsetParent.
      const lidBox = () => {
        let x = 0;
        let y = 0;
        for (let n: HTMLElement | null = lid; n && n !== stage; n = n.offsetParent as HTMLElement | null) {
          x += n.offsetLeft;
          y += n.offsetTop;
        }
        return { x, y, w: lid.offsetWidth, h: lid.offsetHeight };
      };
      const start = () => {
        const b = lidBox();
        const w = (b.w * HERO.w) / LID.widthMm;
        return { w, x: b.x + (b.w * HERO.x) / LID.widthMm - w / 2, y: b.y + (b.h * HERO.y) / LID.heightMm - (w * aspect) / 2 };
      };
      // Laid out at its final (largest) size and scaled down at the start, so it stays sharp when big.
      const finalW = () => Math.min(stage.offsetWidth * 0.5, (stage.offsetHeight * 0.5) / aspect, 720);
      const size = () => (big.style.width = `${finalW()}px`);
      size();
      // Positions are for the element's top-left; scaling happens around its centre.
      const from = () => {
        const st = start();
        const F = finalW();
        return { x: st.x + st.w / 2 - F / 2, y: st.y + (st.w * aspect) / 2 - (F * aspect) / 2, scale: st.w / F };
      };
      const end = () => ({ x: stage.offsetWidth / 2 - finalW() / 2, y: stage.offsetHeight * 0.42 - (finalW() * aspect) / 2 });
      if (ctx.conditions?.still) {
        gsap.set(big, { x: end().x, y: end().y, scale: 1, rotation: -8 });
        gsap.set(q("[data-lidwrap]"), { opacity: 0 });
        return;
      }
      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: el,
          // Plays while the CSS-sticky stage is held (no ScrollTrigger pin: no jitter or layout shift on touch
          // scrolling). Phones hold it over about half the scroll (section height below).
          start: "top top",
          end: "bottom bottom",
          scrub: 0.9,
          invalidateOnRefresh: true,
          onRefreshInit: size,
        },
      });
      tl.fromTo(
        big,
        { x: () => from().x, y: () => from().y, scale: () => from().scale, rotation: 0 },
        { x: () => end().x, y: () => end().y, scale: 1, rotation: -8, duration: 1 },
        0.15,
      )
        .fromTo(q("[data-lidwrap]"), { scale: 1, opacity: 1 }, { scale: 0.7, opacity: 0, duration: 0.8 }, 0.15)
        .fromTo(q("[data-type]"), { scale: 0.9, opacity: 0.25 }, { scale: 1, opacity: 1, duration: 0.8 }, 0.2)
        .fromTo(q("[data-mark]"), { backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%", duration: 0.3 }, 0.8)
        .fromTo(q("[data-cta]"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35 }, 1)
        // Hold the finished scene for a long scroll before the footer can come up.
        .to({}, { duration: 1.6 });
    });
    return () => mm.revert();
  }, [aspect]);

  return (
    // One screen + the scroll the scene plays over; svh keeps the page height steady as a phone's address bar moves.
    <section ref={root} className="relative h-[280svh] bg-bg motion-reduce:h-svh md:h-[460svh]">
      <div data-stage className="sticky top-0 h-svh cursor-copy overflow-hidden" onClick={slap}>
        <div data-type className="absolute inset-x-0 top-[12vh] px-4 text-center">
          <h2 className="text-[clamp(3.5rem,13vw,12rem)] leading-[0.86] font-extrabold tracking-[-0.055em] uppercase">
            <span className="block">{lineA}</span>
            <span className="block">
              {lineB}{" "}
              <span
                data-mark
                className="bg-[linear-gradient(#D7FF3A,#D7FF3A)] bg-no-repeat px-[0.05em] text-[#111] [background-position:0_82%] [background-size:100%_100%]"
              >
                {mark}
              </span>
            </span>
          </h2>
        </div>

        <div className="absolute inset-0 grid place-items-center px-6">
          <div data-lidwrap className="w-[min(70vw,620px)]">
            <div data-lid className="relative drop-shadow-[0_30px_50px_rgb(0_0_0/0.25)]">
              <LidArt
                logo={LID.logo}
                logoFinish={MODEL.logoFinish}
                widthMm={LID.widthMm}
                heightMm={LID.heightMm}
                radiusMm={LID.cornerRadiusMm}
                color="#CACBCE"
                stickers={AROUND}
                className="h-auto w-full rounded-xl"
                lazy
              />
            </div>
          </div>
        </div>

        {/* The sticker that breaks out */}
        <div data-big className="pointer-events-none absolute top-0 left-0 will-change-transform">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stickerSrc(hero)}
            alt=""
            width={hero.viewBox[0]}
            height={hero.viewBox[1]}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="block h-auto w-full drop-shadow-[0_14px_24px_rgb(0_0_0/0.3)]"
          />
        </div>

        {/* Stickers slapped on by clicking */}
        {slaps.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.key}
            src={s.src}
            alt=""
            draggable={false}
            className="slap-in pointer-events-none absolute h-auto drop-shadow-[0_8px_14px_rgb(0_0_0/0.22)]"
            style={{ left: s.x, top: s.y, width: s.w, "--r": `${s.r}deg` } as React.CSSProperties}
          />
        ))}

        <div data-cta className="absolute inset-x-0 bottom-[7vh] flex flex-col items-center gap-4 px-6 text-center">
          <p className="max-w-[40ch] text-lg font-medium text-ink">{sub}</p>
          <p className="text-xs text-muted">{slapHint}</p>
          <Link
            href="/editor"
            className="cta-run cta-pop group relative inline-flex items-center gap-3 rounded-full bg-[#D7FF3A] px-10 py-5 text-xl font-extrabold text-[#111] sm:px-12 sm:py-6 sm:text-2xl"
          >
            {cta}
            <ArrowRight className="cta-run-arrow size-6" strokeWidth={2.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}
