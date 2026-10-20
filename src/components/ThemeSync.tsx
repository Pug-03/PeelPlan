"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect } from "react";

function applyTheme() {
  const root = document.documentElement;
  root.classList.add("js");
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("peelplan.theme");
  } catch {
    /* storage unavailable */
  }
  // Light is the brand default; dark only when the visitor picks it.
  const want = stored ?? "light";
  if (root.dataset.theme !== want) root.dataset.theme = want;
}

// Applies a stored theme before paint to avoid a flash.
// Also stamps the system theme when nothing is stored, so dark: utilities and the toggle agree,
// and marks JS as available (scroll reveals only hide content when they can show it again).
const themeScript = `(function(){var d=document.documentElement;d.classList.add("js");var t;try{t=localStorage.getItem("peelplan.theme")}catch(e){}d.dataset.theme=t||"light"})()`;

/**
 * Pre-paint theme script for <head>. It only needs to run from the server HTML: when a language switch
 * re-mounts the root layout on the client, it renders as an inert data block (ThemeSync covers that case),
 * which also keeps React from warning about a client-rendered <script>.
 */
export function ThemeScript() {
  return <script suppressHydrationWarning type={typeof window === "undefined" ? undefined : "text/plain"} dangerouslySetInnerHTML={{ __html: themeScript }} />;
}

/**
 * Keeps the chosen theme on <html>. Switching language re-renders the [locale] root layout, which resets
 * <html> attributes, and the pre-paint script in <head> doesn't run again on client navigation.
 * Re-apply on every locale change, and restore it if anything strips the attribute.
 */
export function ThemeSync() {
  const locale = useLocale();
  useLayoutEffect(() => {
    applyTheme();
    const root = document.documentElement;
    const mo = new MutationObserver(() => {
      if (!root.dataset.theme || !root.classList.contains("js")) applyTheme();
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => mo.disconnect();
  }, [locale]);
  return null;
}
