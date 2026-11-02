"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A thin lime bar along the top that starts the moment an in-app link is clicked and completes when the
 * new page lands. Without it a page that takes a moment to load leaves the click looking ignored, and
 * then the page swaps all at once. Only same-origin links to a different path count; new tabs,
 * downloads, modifier clicks and in-page anchors don't.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const from = useRef(pathname);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      from.current = location.pathname;
      setState("loading");
    };
    // Capture phase: Next's <Link> calls preventDefault in its own handler, which runs before a bubbling one.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The new page is in: run the bar to the end, then let it fade.
  useEffect(() => {
    if (pathname === from.current) return;
    from.current = pathname;
    setState((s) => (s === "loading" ? "done" : s));
  }, [pathname]);

  useEffect(() => {
    if (state === "done") {
      const id = setTimeout(() => setState("idle"), 450);
      return () => clearTimeout(id);
    }
    // A navigation that never lands (offline, cancelled) shouldn't leave the bar hanging.
    if (state === "loading") {
      const id = setTimeout(() => setState("idle"), 10000);
      return () => clearTimeout(id);
    }
  }, [state]);

  return <div aria-hidden="true" className="nav-progress" data-state={state} />;
}
