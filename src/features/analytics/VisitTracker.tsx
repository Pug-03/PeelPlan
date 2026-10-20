"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordView, visitId } from "./client";
import { cleanPath, deviceClass, isTrackable, optedOut, referrerHost } from "./stats";

/**
 * Records one page view per route change. Cookieless and first-party: see ./stats.ts for exactly
 * what is kept. Honours Do Not Track and Global Privacy Control by recording nothing at all.
 */
export function VisitTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  const last = useRef<string | null>(null);

  useEffect(() => {
    // Same path again = React re-running the effect (Strict Mode), not a new view.
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (optedOut(nav, (window as Window & { doNotTrack?: string }).doNotTrack)) return;
    const { path, locale } = cleanPath(pathname);
    if (!isTrackable(path)) return;
    // document.referrer doesn't change on client-side navigation, so only the landing view carries it.
    const ref = first.current ? referrerHost(document.referrer, location.hostname) : null;
    first.current = false;
    void recordView({
      path,
      locale: locale ?? document.documentElement.lang ?? "",
      ref,
      device: deviceClass(window.innerWidth),
      sid: visitId(),
      at: new Date().toISOString(),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
