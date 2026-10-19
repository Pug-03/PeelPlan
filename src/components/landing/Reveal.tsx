"use client";

import { useEffect } from "react";

/** Adds `is-visible` to `.reveal` elements as they enter the viewport, including ones streamed in later. */
export function RevealOnScroll() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const watch = (root: ParentNode) => root.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)").forEach((el) => io.observe(el));
    watch(document);
    // Async server sections can stream in after this runs.
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && (n.matches(".reveal") ? io.observe(n) : watch(n)));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
