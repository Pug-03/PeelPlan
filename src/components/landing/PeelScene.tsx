"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { VISIBLE_LIBRARY, stickerSrc } from "@/stickers/library";

/**
 * Pinned scene: one sticker spins in a glowing ring, its backing paper peels away, and its
 * real size draws in around it. The glow and sparks are CSS; no 3D library.
 */

const STICKER_ID = "peel-star";

/** Deterministic sparks around the ring. */
const SPARKS = Array.from({ length: 56 }, (_, i) => {
  let h = (i + 1) * 2654435761;
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
  const a = r() * Math.PI * 2;
  const d = 0.36 + r() * 0.2;
  // Rounded so server and client render identical style strings.
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    x: round(50 + Math.cos(a) * d * 100),
    y: round(50 + Math.sin(a) * d * 100),
    s: round(1 + r() * 2.5),
    delay: round(r() * 4),
    dur: round(2.5 + r() * 3),
  };
});

export function PeelScene({ title, titleB, body, peelLabel }: { title: string; titleB: string; body: string; peelLabel: string }) {
  const root = useRef<HTMLElement>(null);
  const def = useMemo(() => VISIBLE_LIBRARY.find((s) => s.id === STICKER_ID) ?? VISIBLE_LIBRARY[0], []);
  const hMm = (def.widthMm * def.viewBox[1]) / def.viewBox[0];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    // The ring and sparks are endless CSS animations; hold them while the scene is off screen.
    const io = new IntersectionObserver(([e]) => el.toggleAttribute("data-offscreen", !e.isIntersecting));
    io.observe(el);
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", small: "(max-width: 767px)" }, (ctx) => {
      if (!ctx.conditions?.motion) return;
      const q = gsap.utils.selector(el);
      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        // Phones get a shorter pin: the page is already very tall there.
        scrollTrigger: { trigger: el, start: "top top", end: ctx.conditions.small ? "+=85%" : "+=160%", pin: true, scrub: 0.9 },
      });
      tl.fromTo(q("[data-card]"), { rotationY: -200, rotationX: 18, scale: 0.7 }, { rotationY: 0, rotationX: 0, scale: 1, duration: 1.2 }, 0)
        .fromTo(q("[data-ring]"), { scale: 0.6, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 1.2 }, 0)
        .fromTo(q("[data-title]"), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5 }, 0.1)
        // The liner lifts from one corner and slides away.
        .to(q("[data-liner]"), { rotation: -28, xPercent: -70, yPercent: -40, opacity: 0, duration: 0.8, ease: "power2.in" }, 1.25)
        .fromTo(q("[data-glow]"), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.6)
        .fromTo(q("[data-dim]"), { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, 1.8)
        .fromTo(q("[data-dim-y]"), { scaleY: 0 }, { scaleY: 1, duration: 0.5 }, 1.95)
        .fromTo(q("[data-dim-label]"), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.15 }, 2)
        .fromTo(q("[data-body]"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 }, 2.1);
    });
    return () => {
      io.disconnect();
      mm.revert();
    };
  }, []);

  return (
    <section ref={root} className="peel-scene relative h-[100dvh] overflow-hidden" aria-label={`${title} ${titleB}`}>
      {/* Glow ring and sparks */}
      <div data-ring aria-hidden="true" className="absolute top-1/2 left-1/2 aspect-square w-[min(82vh,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="peel-ring absolute inset-[14%] rounded-full" />
        <div className="absolute inset-[24%] rounded-full bg-[radial-gradient(circle,rgb(80_200_255/0.14),transparent_70%)]" />
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="peel-spark absolute rounded-full bg-[#4FB8E8]"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
          />
        ))}
      </div>

      <div data-title className="absolute top-[9vh] left-0 w-full px-6 text-center sm:top-[11vh]">
        <h2 className="text-[clamp(2.6rem,7vw,6rem)] leading-[0.95] font-extrabold tracking-[-0.045em]">
          {title} <span className="editorial-italic block font-normal text-[#2E9BD6] sm:inline">{titleB}</span>
        </h2>
      </div>

      {/* The sticker: front art with a backing liner, back face is the printed liner */}
      <div className="absolute inset-0 grid place-items-center [perspective:1000px]">
        <div className="relative">
          <div data-card className="relative w-[min(34vh,300px)] [transform-style:preserve-3d]">
            <div className="relative [backface-visibility:hidden]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={stickerSrc(def)}
                alt=""
                width={def.viewBox[0]}
                height={def.viewBox[1]}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="block h-auto w-full drop-shadow-[0_18px_30px_rgb(0_0_0/0.18)]"
              />
              <div
                data-glow
                aria-hidden="true"
                className="absolute -inset-6 -z-10 rounded-full bg-[radial-gradient(circle,rgb(255_210_80/0.35),transparent_65%)] blur-xl"
              />
              <div
                data-liner
                aria-hidden="true"
                className="absolute -inset-[4%] origin-top-left rounded-[22%] bg-[repeating-linear-gradient(135deg,#F5F3EE_0_10px,#ECE9E1_10px_20px)] shadow-[0_10px_30px_rgb(0_0_0/0.35)]"
              >
                <span className="absolute inset-0 grid place-items-center text-center text-xs font-semibold tracking-[0.25em] text-[#9A968C] uppercase">
                  {peelLabel}
                </span>
              </div>
            </div>
            <div className="absolute inset-0 grid place-items-center rounded-[22%] bg-[repeating-linear-gradient(135deg,#F5F3EE_0_10px,#ECE9E1_10px_20px)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="text-xs font-semibold tracking-[0.25em] text-[#9A968C] uppercase">PeelPlan · 1:1</span>
            </div>
          </div>

          {/* Real-size readout */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-8 left-0 w-full">
            <div data-dim className="h-px w-full origin-left bg-ink/50" />
            <p data-dim-label className="mt-1 text-center text-xs tabular-nums text-muted">
              {def.widthMm.toFixed(1)} mm
            </p>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute top-0 -right-10 h-full">
            <div data-dim-y className="h-full w-px origin-top bg-ink/50" />
            <p data-dim-label className="absolute top-1/2 left-2 -translate-y-1/2 text-xs whitespace-nowrap tabular-nums text-muted [writing-mode:vertical-rl]">
              {hMm.toFixed(1)} mm
            </p>
          </div>
        </div>
      </div>

      <p data-body className="absolute inset-x-0 bottom-[8vh] mx-auto max-w-[46ch] px-6 text-center leading-relaxed text-muted">
        {body}
      </p>
    </section>
  );
}
