"use client";

import { useEffect } from "react";

/** Press F anywhere (outside text fields) to toggle full screen; Esc or F again leaves it. */
export function FullscreenKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // By physical key, so it also works with a Thai keyboard layout (where F types "ด").
      if (e.code !== "KeyF") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
