"use client";

import { useEffect, useState } from "react";
import { RulerMark } from "@/components/Wordmark";
import { VISIBLE_LIBRARY, stickerSrc } from "@/stickers/library";

declare global {
  interface Window {
    __peelplanIntroDone?: boolean;
  }
}

const NAME = "PeelPlan";

/** Stickers slapped onto the sheet around the name: centre position (% of the screen), width and tilt. */
const SLAPS = [
  { id: "code-coder", x: 15, y: 20, w: 17, r: -10 },
  { id: "p2-cat", x: 84, y: 19, w: 11, r: 9 },
  { id: "p2-sun", x: 63, y: 11, w: 7, r: -8 },
  { id: "peel-star", x: 90, y: 52, w: 7, r: 14 },
  { id: "boba", x: 9, y: 58, w: 7, r: -9 },
  { id: "p2-rainbow", x: 76, y: 75, w: 13, r: 6 },
  { id: "code-rubber-duck", x: 24, y: 77, w: 9, r: 10 },
].flatMap((s) => {
  const def = VISIBLE_LIBRARY.find((d) => d.id === s.id);
  return def ? [{ ...s, src: stickerSrc(def), aspect: def.viewBox[1] / def.viewBox[0] }] : [];
});

/** True when this document was loaded on the current path, i.e. not reached by client-side navigation. */
function loadedHere() {
  const nav = performance.getEntriesByType("navigation")[0];
  try {
    return !nav || new URL(nav.name).pathname === location.pathname;
  } catch {
    return true;
  }
}

/**
 * Opening sequence on a full page load: the screen is one big sticker that carries the PeelPlan mark,
 * then peels away from the bottom-right corner to reveal the site. Pure CSS timing (see globals.css),
 * so it covers the page from the first paint, before hydration. Click or any key skips it.
 * It does not play on client-side navigation to the landing page (first visit or back).
 */
export function Intro({ tagline }: { tagline: string }) {
  // On a client-side navigation (the flag is set, or the page was loaded on another path) nothing renders.
  const [show] = useState(() => typeof window === "undefined" || (!window.__peelplanIntroDone && loadedHere()));
  const [skipped, setSkipped] = useState(false);
  // Unmount when the peel ends so nothing invisible is left covering the page.
  const [gone, setGone] = useState(false);

  // The hero holds its entrance for the intro; release it when there is no intro or it was skipped.
  useEffect(() => {
    const main = document.getElementById("main");
    if (!show) main?.classList.remove("has-intro");
    else if (skipped) main?.classList.add("intro-skipped");
  }, [show, skipped]);

  useEffect(() => {
    if (!show) return;
    const done = () => (window.__peelplanIntroDone = true);
    const skip = () => setSkipped(true);
    const t = setTimeout(() => {
      done();
      setGone(true);
    }, 2400);
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      clearTimeout(t);
      done();
      window.removeEventListener("keydown", skip);
    };
  }, [show]);

  useEffect(() => {
    if (!skipped) return;
    const t = setTimeout(() => setGone(true), 400);
    return () => clearTimeout(t);
  }, [skipped]);

  if (!show || gone) return null;
  return (
    <div className={`intro ${skipped ? "intro-skip" : ""}`} aria-hidden="true" onPointerDown={() => setSkipped(true)}>
      <div className="intro-sheet">
        {/* Die-cut line of the sheet, drawn in first */}
        <svg className="intro-cut" preserveAspectRatio="none">
          <rect x="1.5%" y="1.5%" width="97%" height="97%" rx="28" pathLength={1} />
        </svg>
        <p className="intro-spec intro-spec-l">PeelPlan · sheet 001</p>
        <p className="intro-spec intro-spec-r">1:1 · ±1 mm</p>

        {SLAPS.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.id}
            src={s.src}
            alt=""
            draggable={false}
            className="intro-slap"
            style={
              {
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `clamp(${Math.round(s.w * 6)}px, ${s.w}vw, ${Math.round(s.w * 15)}px)`,
                "--r": `${s.r}deg`,
                animationDelay: `${420 + i * 95}ms`,
              } as React.CSSProperties
            }
          />
        ))}

        <div className="intro-content">
          <span className="intro-badge">
            <RulerMark className="intro-mark" />
          </span>
          <p className="intro-name">
            {NAME.split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: `${260 + i * 40}ms` }}>
                {ch}
              </span>
            ))}
          </p>
          <p className="intro-tagline">{tagline}</p>
        </div>

        {/* A lid-wide ruler counting up to the 14" Pro's width */}
        <div className="intro-ruler">
          <span className="intro-ruler-line" />
          <p className="intro-count">
            <span className="intro-count-n" />
            .6 <small>mm</small>
          </p>
        </div>
      </div>
      {/* The sticker's backing side, folded over the peel line. */}
      <div className="intro-flap" />
    </div>
  );
}
