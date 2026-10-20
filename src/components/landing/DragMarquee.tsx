"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Auto-scroll speed in px/s; the track drifts left until someone grabs it. */
const AUTO_SPEED = 28;
const FRICTION = 0.94;

/**
 * Infinite strip that drifts on its own and can be dragged, swiped, trackpad-scrolled or moved with
 * the arrow keys. Release with a flick and it glides with momentum before resuming its drift.
 * `children` must contain the item list twice (the second copy aria-hidden) for a seamless wrap.
 */
export function DragMarquee({ children, pauseLabel, playLabel, label }: { children: ReactNode; pauseLabel: string; playLabel: string; label: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const state = useRef({
    offset: 0,
    velocity: 0,
    dragging: false,
    lastX: 0,
    lastT: 0,
    hover: false,
    focus: false,
    visible: true,
    paused: false,
    reduce: false,
    target: null as number | null,
  });

  useEffect(() => {
    state.current.paused = paused;
  }, [paused]);

  useEffect(() => {
    const s = state.current;
    s.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = viewport.current!;
    const tr = track.current!;
    let raf = 0;
    let last = performance.now();

    const half = () => tr.scrollWidth / 2;
    const apply = () => {
      const h = half();
      if (h > 0) s.offset = ((s.offset % h) + h) % h;
      tr.style.transform = `translate3d(${-s.offset}px,0,0)`;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s.dragging) {
        if (s.target !== null) {
          // Keyboard step: ease towards the target.
          const d = s.target - s.offset;
          s.offset += d * Math.min(1, dt * 10);
          if (Math.abs(d) < 0.5) s.target = null;
        } else {
          // Keeps drifting under the pointer; only a grab, keyboard focus or the pause button stops it.
          const drifting = !s.paused && !s.focus && !s.reduce;
          s.offset += s.velocity * dt + (drifting ? AUTO_SPEED * dt : 0);
          s.velocity *= Math.pow(FRICTION, dt * 60);
          if (Math.abs(s.velocity) < 1) s.velocity = 0;
        }
      }
      apply();
      raf = s.visible ? requestAnimationFrame(tick) : 0;
    };

    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting;
      if (s.visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(el);

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      s.dragging = true;
      s.velocity = 0;
      s.target = null;
      s.lastX = e.clientX;
      s.lastT = performance.now();
      setGrabbing(true);
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      const now = performance.now();
      const dx = e.clientX - s.lastX;
      s.offset -= dx;
      // Smoothed velocity (px/s) for the release flick.
      const inst = (-dx / Math.max(1, now - s.lastT)) * 1000;
      s.velocity = s.velocity * 0.6 + inst * 0.4;
      s.lastX = e.clientX;
      s.lastT = now;
      apply();
    };
    const up = (e: PointerEvent) => {
      if (!s.dragging) return;
      s.dragging = false;
      setGrabbing(false);
      if (performance.now() - s.lastT > 80) s.velocity = 0; // held still before letting go: no flick
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      // Horizontal trackpad swipes move the strip; vertical wheel keeps scrolling the page.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      s.offset += e.deltaX;
      s.velocity = 0;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const step = (tr.firstElementChild as HTMLElement | null)?.offsetWidth ?? 320;
      s.target = (s.target ?? s.offset) + (e.key === "ArrowRight" ? step + 20 : -(step + 20));
    };
    const enter = () => (s.hover = true);
    const leave = () => (s.hover = false);
    const focusIn = () => (s.focus = true);
    const focusOut = () => (s.focus = false);

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("keydown", key);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("keydown", key);
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
    };
  }, []);

  return (
    <>
      <div
        ref={viewport}
        tabIndex={0}
        role="group"
        aria-label={label}
        aria-roledescription="carousel"
        onDragStart={(e) => e.preventDefault()}
        className={`touch-pan-y overflow-hidden py-6 outline-offset-4 select-none ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div ref={track} className="flex w-max gap-5 will-change-transform">
          {children}
        </div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? playLabel : pauseLabel}
        onClick={() => setPaused((p) => !p)}
        className="absolute right-5 bottom-0 z-10 grid size-9 place-items-center rounded-full border border-hairline bg-bg text-muted shadow-soft transition-colors hover:text-ink sm:right-8"
      >
        {paused ? <Play className="size-3.5" strokeWidth={2} /> : <Pause className="size-3.5" strokeWidth={2} />}
      </button>
    </>
  );
}
