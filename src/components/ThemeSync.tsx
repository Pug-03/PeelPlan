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
 * Browser extensions (ad blockers, Google Translate) slip their own nodes into <head> and <body> and take
 * them out again. Switching language remounts the [locale] root layout, and if React then removes a node
 * an extension already moved or removed, removeChild/insertBefore throw and the whole page drops to the
 * error screen. Instead, a removal of a node that's already gone is a no-op, and an insert before a
 * vanished node appends (the content stays on the page, at worst slightly out of order).
 */
const domGuardScript = `(function(){var P=Node.prototype;if(P.__peelGuard)return;P.__peelGuard=1;var r=P.removeChild,i=P.insertBefore;P.removeChild=function(c){return c&&c.parentNode!==this?c:r.apply(this,arguments)};P.insertBefore=function(n,b){return b&&b.parentNode!==this?this.appendChild(n):i.apply(this,arguments)}})()`;

/** Runs before React hydrates; same server-only trick as ThemeScript. */
export function DomGuardScript() {
  return <script suppressHydrationWarning type={typeof window === "undefined" ? undefined : "text/plain"} dangerouslySetInnerHTML={{ __html: domGuardScript }} />;
}

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
