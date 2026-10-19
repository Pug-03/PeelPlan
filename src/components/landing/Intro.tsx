"use client";

import { useEffect, useState } from "react";
import { RulerMark } from "@/components/Wordmark";

declare global {
  interface Window {
    __peelplanIntroDone?: boolean;
  }
}

const NAME = "PeelPlan";

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
    }, 2150);
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
        <div className="intro-content">
          <RulerMark className="intro-mark" tone="inverse" />
          <p className="intro-name">
            {NAME.split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: `${380 + i * 45}ms` }}>
                {ch}
              </span>
            ))}
          </p>
          <div className="intro-ruler">
            <span className="intro-ruler-line" />
            <span className="intro-ruler-label">1:1 · {tagline}</span>
          </div>
        </div>
      </div>
      {/* The sticker's backing side, folded over the peel line. */}
      <div className="intro-flap" />
    </div>
  );
}
