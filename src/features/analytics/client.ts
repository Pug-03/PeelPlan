"use client";

/**
 * Where page views go and how the admin reads them back.
 * - Test mode: appended to this browser's localStorage (capped), so the admin page only reflects this browser.
 * - Supabase: the `track_view` RPC (anon allowed, validated and rate-limited in the database) and the
 *   admin-only `admin_visitor_stats` RPC, which returns aggregates so raw rows never reach the client.
 */
import { AUTH_ENABLED } from "@/lib/supabase/config";
import { aggregate, type PageView, type VisitorStats } from "./stats";

export const ANALYTICS_KEY = "peelplan.analytics.v1";
const SESSION_KEY = "peelplan.visit.v1";
const MAX_EVENTS = 5000;

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Random id for this tab only (sessionStorage): gone when the tab closes, never shared across sites. */
export function visitId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function readLocalViews(): PageView[] {
  try {
    const list = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]") as PageView[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function recordView(v: PageView): Promise<void> {
  if (!AUTH_ENABLED) {
    try {
      const list = readLocalViews();
      list.push(v);
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(list.slice(-MAX_EVENTS)));
    } catch {
      /* storage unavailable or full: statistics are best effort */
    }
    return;
  }
  const { createSupabaseBrowser } = await import("@/lib/supabase/client");
  await createSupabaseBrowser()?.rpc("track_view", {
    p_path: v.path,
    p_locale: v.locale,
    p_referrer_host: v.ref,
    p_device: v.device,
    p_session_id: v.sid,
  });
}

/** Aggregated statistics for the last `days` days (admin only in Supabase mode). */
export async function visitorStats(days: number): Promise<VisitorStats> {
  if (!AUTH_ENABLED) return aggregate(readLocalViews(), days);
  const { createSupabaseBrowser } = await import("@/lib/supabase/client");
  const sb = createSupabaseBrowser();
  if (!sb) throw new Error("supabase-disabled");
  const { data, error } = await sb.rpc("admin_visitor_stats", { p_days: days });
  if (error) throw new Error(error.message);
  const d = data as VisitorStats;
  return { days: d.days ?? [], topPages: d.topPages ?? [], referrers: d.referrers ?? [], devices: d.devices ?? [], locales: d.locales ?? [] };
}
