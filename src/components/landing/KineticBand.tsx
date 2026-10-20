"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { VISIBLE_LIBRARY, stickerSrc } from "@/stickers/library";

/**
 * Two rows of huge words drifting slowly in opposite directions, with small stickers riding
 * between the words. Kept slow on purpose: big moving type is tiring to watch.
 */

const STICKERS = ["peel-star", "code-rubber-duck", "boba", "code-coder", "smile-blob", "lightning"].map((id) => VISIBLE_LIBRARY.find((s) => s.id === id));

export function KineticBand({ words, wordsB }: { words: string[]; wordsB: string[] }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // A slow, steady drift (one copy of the words every 90 s), not tied to how fast you scroll.
      const tweens = [...el.querySelectorAll<HTMLElement>("[data-row]")].map((row, i) =>
        gsap.fromTo(row, { xPercent: i ? -100 / 3 : 0 }, { xPercent: i ? 0 : -100 / 3, duration: 90, ease: "none", repeat: -1, paused: true }),
      );
      tweens.push(gsap.to(el.querySelectorAll("[data-spin]"), { rotation: 360, duration: 40, ease: "none", repeat: -1, paused: true }));
      // Only run while the band is on screen.
      const io = new IntersectionObserver(([e]) => tweens.forEach((t) => (e.isIntersecting ? t.play() : t.pause())));
      io.observe(el);
      return () => io.disconnect();
    });
    return () => mm.revert();
  }, []);

  const row = (list: string[], outline: boolean) =>
    Array.from({ length: 3 }, (_, k) =>
      list.map((w, i) => {
        const def = STICKERS[(i + k * 2) % STICKERS.length];
        return (
          <span key={`${k}-${i}`} className="flex shrink-0 items-center gap-[0.35em]">
            {/^[±\d]/.test(w) ? (
              // Figures ("1:1", "±1 mm") use the editorial serif italic, like the stat callouts.
              <span className="kinetic-figure">
                {w.startsWith("±") ? (
                  <>
                    {/* The serif's own ± is tiny; draw a tall one in the same slanted stroke. */}
                    <svg
                      viewBox="0 0 10 13"
                      aria-hidden="true"
                      className="mr-[0.06em] inline-block h-[0.62em] w-auto align-baseline"
                      style={{ transform: "skewX(-12deg)" }}
                    >
                      <path d="M5 0.6V8.2M1.2 4.4H8.8M1.2 12.2H8.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" />
                    </svg>
                    {w.slice(1)}
                  </>
                ) : (
                  w
                )}
              </span>
            ) : (
              <span className={outline && i % 2 === 0 ? "kinetic-outline" : ""}>{w}</span>
            )}
            {def && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                data-spin
                src={stickerSrc(def)}
                alt=""
                width={def.viewBox[0]}
                height={def.viewBox[1]}
                loading="lazy"
                decoding="async"
                className="h-[0.7em] w-auto drop-shadow-[0_4px_8px_rgb(0_0_0/0.15)]"
                draggable={false}
              />
            )}
          </span>
        );
      }),
    );

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="flex flex-col gap-2 overflow-hidden py-16 select-none [font-family:var(--font-display),var(--font-anuphan),sans-serif] sm:py-24"
    >
      <div
        data-row
        className="flex w-max gap-[0.35em] text-[clamp(3.5rem,11vw,10rem)] leading-none font-extrabold tracking-[-0.05em] whitespace-nowrap uppercase"
      >
        {row(words, true)}
      </div>
      <div
        data-row
        className="flex w-max gap-[0.35em] text-[clamp(3.5rem,11vw,10rem)] leading-none font-extrabold tracking-[-0.05em] whitespace-nowrap text-muted uppercase"
      >
        {row(wordsB, false)}
      </div>
    </div>
  );
}
