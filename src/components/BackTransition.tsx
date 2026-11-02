"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Link navigations animate through React's <ViewTransition> (see template.tsx), but the browser's back and
 * forward buttons (and swipe gestures) commit without a transition, so the page just snapped. This watches
 * for those history moves and slides the arriving page in from the side it came from: from the left going
 * back, from the right going forward, mirroring the link animation. Only the page content moves; the
 * header stays put.
 */
export function BackTransition() {
  const pathname = usePathname();
  const pending = useRef<"back" | "forward" | null>(null);
  const last = useRef(pathname);

  useEffect(() => {
    const nav = (window as { navigation?: EventTarget & { currentEntry?: { index: number } } }).navigation;
    if (nav) {
      const onNavigate = (e: Event) => {
        const ev = e as Event & { navigationType?: string; destination?: { index: number } };
        if (ev.navigationType !== "traverse" || !ev.destination || !nav.currentEntry) return;
        pending.current = ev.destination.index < nav.currentEntry.index ? "back" : "forward";
      };
      nav.addEventListener("navigate", onNavigate);
      return () => nav.removeEventListener("navigate", onNavigate);
    }
    // No Navigation API: a popstate is a history move, most likely back.
    const onPop = () => (pending.current = "back");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Layout effect: start before the browser paints the new page, so it never shows in place first.
  useLayoutEffect(() => {
    if (pathname === last.current) return;
    last.current = pathname;
    const dir = pending.current;
    pending.current = null;
    if (!dir) return;
    const main = document.querySelector("main");
    if (!main) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = dir === "back" ? -56 : 56;
    main.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateX(${from}px)`, filter: "blur(6px)" },
            { opacity: 1, transform: "none", filter: "blur(0)" },
          ],
      { duration: reduce ? 160 : 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [pathname]);

  return null;
}
