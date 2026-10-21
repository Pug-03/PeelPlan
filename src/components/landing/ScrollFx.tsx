"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Calm scroll-driven motion for landing sections, declared with data attributes so the sections
 * stay server components:
 * - `data-fx="countup"` + `data-to` (and optional `data-decimals`): number counts up when it enters.
 * - `data-fx="steps"`: `[data-fx-line]` grows with scroll, `[data-fx-item]` light up in turn.
 * - `data-fx="fan"`: `[data-fx-item]` start stacked in the middle and deal out into place.
 * - `data-fx="loop"` + `data-dir` (1 or -1): a doubled row that runs endlessly, faster while scrolling.
 * - `data-fx="drift"` + `data-speed` (%, may be negative): slides sideways while in view.
 * - `data-fx="parallax"` + `data-speed` (px): floats up or down while in view.
 * - `data-fx="draw"`: `[data-fx-path]` strokes draw one after another.
 * - `data-fx="print"`: `[data-fx-paper]` feeds out of the printer.
 * - `data-fx="hscroll"`: holds the sticky `[data-fx-frame]` and moves `[data-fx-track]` sideways as you scroll down.
 * - `data-fx="sheet"`: the section slides up over the one before it like a sheet being laid down.
 * - `data-tilt`: a card that tilts in 3D under the pointer with a glare that follows it.
 * Everything rests at its final state under reduced motion.
 */
export function ScrollFx() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", small: "(max-width: 767px)" }, (ctx) => {
      if (!ctx.conditions?.motion) return;
      const small = !!ctx.conditions.small;
      const all = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);
      const undo: (() => void)[] = [];

      // A CSS-sticky frame inside a section made taller by the row's travel, instead of a ScrollTrigger
      // pin: the compositor holds it, so touch scrolling can't make it jitter or shift the layout.
      all('[data-fx="hscroll"]').forEach((el) => {
        const frame = el.querySelector<HTMLElement>("[data-fx-frame]");
        const track = el.querySelector<HTMLElement>("[data-fx-track]");
        if (!frame || !track) return;
        const distance = () => Math.max(0, track.scrollWidth - frame.clientWidth);
        // Phones move the row about twice as far per scroll, so the hold doesn't eat several screens.
        const holdLength = () => distance() * (small ? 0.55 : 1);
        const size = () => (el.style.height = `calc(100svh + ${Math.round(holdLength())}px)`);
        size();
        undo.push(() => (el.style.height = ""));
        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.8, invalidateOnRefresh: true, onRefreshInit: size },
        });
      });

      // Phones slide the sheet up without the shrink and corner rounding: those repaint the whole
      // section on every frame, which is what made this stretch stutter on a phone.
      all('[data-fx="sheet"]').forEach((el) => {
        gsap.fromTo(el, small ? { y: 80 } : { borderTopLeftRadius: 56, borderTopRightRadius: 56, scale: 0.94, y: 80 }, {
          ...(small ? {} : { borderTopLeftRadius: 0, borderTopRightRadius: 0, scale: 1 }),
          y: 0,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "top 25%", scrub: true },
        });
      });

      all('[data-fx="countup"]').forEach((el) => {
        const to = Number(el.dataset.to ?? el.textContent);
        const decimals = Number(el.dataset.decimals ?? 0);
        const v = { n: 0 };
        el.textContent = (0).toFixed(decimals);
        gsap.to(v, {
          n: to,
          duration: 1.4,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onUpdate: () => {
            el.textContent = v.n.toFixed(decimals);
          },
        });
      });

      all('[data-fx="steps"]').forEach((el) => {
        const items = el.querySelectorAll<HTMLElement>("[data-fx-item]");
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 55%", scrub: 0.8 } });
        tl.fromTo(el.querySelectorAll("[data-fx-line]"), { scaleX: 0 }, { scaleX: 1, ease: "none", duration: items.length }, 0);
        items.forEach((item, i) => {
          tl.fromTo(item, { opacity: 0.25, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, i * 0.9);
        });
      });

      all('[data-fx="fan"]').forEach((el) => {
        const items = gsap.utils.toArray<HTMLElement>(el.querySelectorAll("[data-fx-item]"));
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        gsap.fromTo(
          items,
          {
            x: (_, t: HTMLElement) => {
              const r = t.getBoundingClientRect();
              return cx - (r.left + r.width / 2);
            },
            y: 60,
            rotate: (i) => (i - (items.length - 1) / 2) * 7,
            scale: 0.9,
          },
          { x: 0, y: 0, rotate: 0, scale: 1, ease: "power2.out", stagger: 0.06, scrollTrigger: { trigger: el, start: "top 85%", end: "top 30%", scrub: 0.8 } },
        );
      });

      // Endless rows: running while on screen, and a scroll pushes them faster for a moment.
      all('[data-fx="loop"]').forEach((el) => {
        const dir = Number(el.dataset.dir ?? 1);
        const run = gsap.fromTo(el, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 45, ease: "none", repeat: -1, paused: true });
        ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => (self.isActive ? run.resume() : run.pause()),
          onUpdate: (self) => {
            const boost = 1 + Math.min(14, Math.abs(self.getVelocity()) / 120);
            gsap.to(run, { timeScale: boost, duration: 0.2, overwrite: true, onComplete: () => void gsap.to(run, { timeScale: 1, duration: 1.2 }) });
          },
        });
      });

      all('[data-fx="drift"]').forEach((el) => {
        const s = Number(el.dataset.speed ?? 10);
        gsap.fromTo(
          el,
          { xPercent: -s / 2 },
          { xPercent: s / 2, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
        );
      });

      all('[data-fx="parallax"]').forEach((el) => {
        const s = Number(el.dataset.speed ?? 40);
        gsap.fromTo(el, { y: s }, { y: -s, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });

      all('[data-fx="draw"]').forEach((el) => {
        const paths = gsap.utils.toArray<SVGGeometryElement>(el.querySelectorAll("[data-fx-path]"));
        // Plays once when it comes into view, then the dash is removed. A scrubbed draw could be left
        // half-drawn wherever the scroll stopped, and a dash leaves gaps once a hover thickens the stroke.
        const clear = () => gsap.set(paths, { clearProps: "strokeDasharray,strokeDashoffset" });
        const tl = gsap.timeline({ paused: true, onComplete: clear });
        paths.forEach((p, i) => {
          const len = p.getTotalLength() + 4;
          gsap.set(p, { strokeDasharray: `${len} ${len}`, strokeDashoffset: len });
          tl.to(p, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" }, i * 0.18);
        });
        const st = ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: () => tl.play() });
        undo.push(() => {
          st.kill();
          tl.kill();
          clear();
        });
      });

      all('[data-fx="print"]').forEach((el) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 50%", scrub: 0.8 } });
        tl.fromTo(
          el.querySelectorAll("[data-fx-paper]"),
          { attr: { transform: "translate(0 -96)" } },
          { attr: { transform: "translate(0 0)" }, ease: "none", duration: 1 },
        );
        tl.fromTo(el.querySelectorAll("[data-fx-ink]"), { opacity: 0 }, { opacity: 1, stagger: 0.12, duration: 0.3 }, 0.25);
      });
      return () => undo.forEach((f) => f());
    });
    // Pointer toys (fine pointers only): tilting cards with a moving glare.
    mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
      const off: (() => void)[] = [];
      gsap.utils.toArray<HTMLElement>("[data-tilt]").forEach((el) => {
        el.classList.add("tilt-glare");
        gsap.set(el, { transformPerspective: 900 });
        const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3.out" });
        const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          ry((px - 0.5) * 14);
          rx(-(py - 0.5) * 12);
          el.style.setProperty("--gx", `${px * 100}%`);
          el.style.setProperty("--gy", `${py * 100}%`);
        };
        const leave = () => {
          rx(0);
          ry(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        off.push(() => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
          el.classList.remove("tilt-glare");
        });
      });
      return () => off.forEach((f) => f());
    });

    // Scroll scenes live in several components; once all have mounted (and the hscroll section has its
    // height), order every trigger by its place on the page and measure them all again.
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    });

    // Marks sections that are off screen; landing-extras.css pauses their endless CSS loops meanwhile.
    const sections = document.querySelectorAll<HTMLElement>("main > section");
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.toggleAttribute("data-offscreen", !e.isIntersecting)), {
      rootMargin: "100px 0px",
    });
    sections.forEach((s) => io.observe(s));
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      sections.forEach((s) => s.removeAttribute("data-offscreen"));
      mm.revert();
    };
  }, []);
  return null;
}
