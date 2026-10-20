"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LidArt } from "@/components/LidArt";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { VISIBLE_LIBRARY, stickerSrc } from "@/stickers/library";

/**
 * Pinned scroll scene: stickers tumble through space around huge type, then a MacBook lid tilts up
 * and every sticker lands on it at real size. Editorial, monochrome, one highlighter accent.
 */

const MODEL = getLaptopModel("macbook-pro-14-m5");
const LID = lidGeometry(MODEL);
const byId = new Map(VISIBLE_LIBRARY.map((s) => [s.id, s]));

/** Final layout on the lid (mm) and where each sticker floats before it lands (% of the stage, depth). */
const PIECES: { ids: string[]; x: number; y: number; w: number; r: number; from: [number, number, number, number, number, number] }[] = [
  // ids: first visible one wins (demo logos fall back to in-house art).
  { ids: ["lang-python", "peel-star"], x: 52, y: 42, w: 40, r: -8, from: [8, 18, 1.9, 40, -30, -25] },
  { ids: ["code-coder"], x: 150, y: 36, w: 66, r: 4, from: [46, 8, 1.4, -35, 20, 18] },
  { ids: ["lang-rust", "tiny-planet"], x: 258, y: 44, w: 40, r: 10, from: [86, 14, 2.2, 25, 40, 30] },
  { ids: ["code-rubber-duck"], x: 60, y: 112, w: 44, r: 6, from: [4, 52, 1.6, -20, -45, -12] },
  { ids: ["lang-react", "smile-blob"], x: 250, y: 118, w: 40, r: -6, from: [92, 50, 1.7, 30, 35, 22] },
  { ids: ["code-term-tests"], x: 160, y: 170, w: 70, r: -3, from: [56, 88, 1.5, 50, -20, -8] },
  { ids: ["code-key-copy"], x: 268, y: 186, w: 32, r: 8, from: [88, 84, 2.4, -40, 25, 35] },
  { ids: ["code-sym-braces"], x: 46, y: 186, w: 32, r: -10, from: [12, 86, 2.1, 35, -35, -30] },
  { ids: ["lang-go", "boba"], x: 104, y: 70, w: 34, r: -12, from: [28, 30, 1.2, -25, 30, -40] },
  { ids: ["code-stamp-ship-it"], x: 206, y: 82, w: 56, r: 6, from: [70, 30, 1.3, 30, -25, 14] },
];

export function StickerStorm({ lineA, lineB, mark, caption, side }: { lineA: string; lineB: string; mark: string; caption: string; side: string }) {
  const root = useRef<HTMLElement>(null);
  const pieces = useMemo(
    () =>
      PIECES.flatMap((p) => {
        const def = p.ids.map((id) => byId.get(id)).find(Boolean);
        return def ? [{ ...p, src: stickerSrc(def), vb: def.viewBox, aspect: def.viewBox[1] / def.viewBox[0] }] : [];
      }),
    [],
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", still: "(prefers-reduced-motion: reduce)", small: "(max-width: 767px)" }, (ctx) => {
      const q = gsap.utils.selector(el);
      const stage = q("[data-stage]")[0] as HTMLElement;
      const lid = q("[data-lid]")[0] as HTMLElement;
      const items = q("[data-piece]") as HTMLElement[];

      // Landing spot of each sticker, measured from the lid's untransformed box.
      const target = (i: number) => {
        const p = pieces[i];
        const lw = lid.offsetWidth;
        const lh = lid.offsetHeight;
        const w = (lw * p.w) / LID.widthMm;
        const h = w * p.aspect;
        return { w, x: lid.offsetLeft + (lw * p.x) / LID.widthMm - w / 2, y: lid.offsetTop + (lh * p.y) / LID.heightMm - h / 2 };
      };
      const size = () => items.forEach((it, i) => (it.style.width = `${target(i).w}px`));
      size();
      const landed = (i: number) => ({ x: target(i).x, y: target(i).y, z: 0, scale: 1, rotationX: 0, rotationY: 0, rotation: pieces[i].r });

      if (ctx.conditions?.still) {
        items.forEach((it, i) => gsap.set(it, landed(i)));
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          // Phones get a shorter pin: the page is already very tall there.
          end: ctx.conditions?.small ? "+=90%" : "+=170%",
          pin: true,
          scrub: 0.9,
          invalidateOnRefresh: true,
          onRefreshInit: size,
        },
      });
      items.forEach((it, i) => {
        const [fx, fy, s, rx, ry, rz] = pieces[i].from;
        tl.fromTo(
          it,
          {
            x: () => (stage.offsetWidth * fx) / 100 - target(i).w / 2,
            y: () => (stage.offsetHeight * fy) / 100 - (target(i).w * pieces[i].aspect) / 2,
            z: 120 * s,
            scale: s,
            rotationX: rx,
            rotationY: ry,
            rotation: rz,
          },
          { x: () => target(i).x, y: () => target(i).y, z: 0, scale: 1, rotationX: 0, rotationY: 0, rotation: pieces[i].r, duration: 1 },
          0.15 + i * 0.05,
        );
      });
      tl.fromTo(lid, { yPercent: 55, rotationX: 58, scale: 0.86, opacity: 0 }, { yPercent: 0, rotationX: 0, scale: 1, opacity: 1, duration: 0.9 }, 0.2)
        .to(q("[data-type]"), { scale: 0.72, opacity: 0.1, filter: "blur(5px)", duration: 0.9 }, 0.25)
        .fromTo(q("[data-mark]"), { backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%", duration: 0.35, ease: "power1.out" }, 0)
        .fromTo(q("[data-caption]"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3 }, 1.15);

      // Gentle idle drift on an inner layer so it never fights the scrubbed transform; it fades out as stickers land.
      const floats = q("[data-float]").map((f, i) =>
        gsap.to(f, { y: i % 2 ? 10 : -10, rotation: i % 2 ? 3 : -3, duration: 2.2 + (i % 4) * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true }),
      );
      tl.eventCallback("onUpdate", () => {
        const k = 1 - Math.min(1, tl.progress() / 0.6);
        floats.forEach((f) => f.timeScale(Math.max(0.0001, k)));
      });
      // No idle drift while the scene is off screen.
      const io = new IntersectionObserver(([e]) => floats.forEach((f) => (e.isIntersecting ? f.resume() : f.pause())));
      io.observe(el);
      return () => io.disconnect();
    });
    return () => mm.revert();
  }, [pieces]);

  return (
    <section ref={root} className="relative z-10 h-[100dvh] overflow-x-clip" aria-label={`${lineA} ${lineB}`}>
      <div data-stage className="absolute inset-0 [perspective:1100px]">
        {/* Side labels, like a print spec sheet */}
        <p className="absolute top-1/2 left-3 hidden origin-center -translate-y-1/2 -rotate-180 text-[11px] tracking-[0.2em] text-muted uppercase [writing-mode:vertical-rl] sm:block">
          {side}
        </p>
        <p className="absolute top-1/2 right-3 hidden -translate-y-1/2 text-[11px] tracking-[0.2em] text-muted uppercase [writing-mode:vertical-rl] sm:block">
          1:1 · ±1 mm · {MODEL.name}
        </p>

        {/* Huge type behind the lid */}
        <div data-type className="absolute inset-0 grid place-items-center px-4">
          <h2 className="text-center text-[clamp(4rem,15vw,13rem)] leading-[0.86] font-extrabold tracking-[-0.055em] text-balance uppercase">
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

        {/* The lid the stickers land on */}
        <div className="absolute inset-0 grid place-items-center px-6 [transform-style:preserve-3d]">
          <div data-lid className="w-[min(78vw,720px)] drop-shadow-[0_30px_50px_rgb(0_0_0/0.28)]">
            <LidArt
              logo={LID.logo}
              logoFinish={MODEL.logoFinish}
              widthMm={LID.widthMm}
              heightMm={LID.heightMm}
              radiusMm={LID.cornerRadiusMm}
              color="#D9DADC"
              stickers={[]}
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>

        {/* Stickers */}
        <div className="pointer-events-none absolute inset-0 [transform-style:preserve-3d]">
          {pieces.map((p, i) => (
            <div key={i} data-piece className="absolute top-0 left-0 will-change-transform [transform-style:preserve-3d]">
              <div data-float>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt=""
                  width={p.vb[0]}
                  height={p.vb[1]}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full drop-shadow-[0_6px_10px_rgb(0_0_0/0.22)]"
                  draggable={false}
                />
              </div>
            </div>
          ))}
        </div>

        <p data-caption className="absolute inset-x-0 bottom-8 text-center text-sm text-muted tabular-nums">
          {caption}
        </p>
      </div>
    </section>
  );
}
