/**
 * First-party, cookieless visit statistics: shared types and pure helpers.
 *
 * A page view records only: path (no query, ids collapsed), locale, the referring site's host, a
 * device class from the viewport width, and a random id that lives in this tab's sessionStorage.
 * No IP, no cookies, no fingerprinting. A "visit" is one tab session on one day (Asia/Bangkok).
 *
 * `aggregate()` is the test-mode twin of the `admin_visitor_stats()` RPC in
 * supabase/migrations/0003_admin_analytics_feedback.sql; keep the two in step.
 */

export type Device = "mobile" | "tablet" | "desktop";
export const DEVICES: Device[] = ["mobile", "tablet", "desktop"];

export type PageView = {
  path: string;
  locale: string;
  /** Host of the referring site, only for the first view of a tab session coming from elsewhere. */
  ref: string | null;
  device: Device;
  /** Random per-tab id (sessionStorage). */
  sid: string;
  /** ISO timestamp. */
  at: string;
};

export type Count = { key: string; count: number };
export type VisitorStats = {
  /** One row per day, oldest first, including empty days. */
  days: { date: string; views: number; visits: number }[];
  topPages: Count[];
  referrers: Count[];
  devices: Count[];
  locales: Count[];
};

export const TIME_ZONE = "Asia/Bangkok";
const LOCALES = ["th", "en"];

/** Phone below 640 px, tablet below 1024 px (Tailwind's sm / lg). */
export function deviceClass(width: number): Device {
  return width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

const UUID_ISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^(?=.*\d)[0-9a-z_-]{20,}$/i;

/**
 * Path to record: no query or hash, locale prefix split off, ids collapsed to ":id" so private
 * order / chat ids never land in the stats and pages group together. Max 200 chars.
 */
export function cleanPath(pathname: string): { path: string; locale: string | null } {
  let p = (pathname.split(/[?#]/)[0] || "/").replace(/\/{2,}/g, "/");
  if (!p.startsWith("/")) p = `/${p}`;
  const segs = p.split("/").filter(Boolean);
  let locale: string | null = null;
  if (segs.length && LOCALES.includes(segs[0])) locale = segs.shift()!;
  const path = `/${segs.map((s) => (UUID_ISH.test(s) ? ":id" : s)).join("/")}`.slice(0, 200);
  return { path, locale };
}

/** Admin pages are never counted. */
export const isTrackable = (path: string) => !/^\/admin(\/|$)/.test(path);

/** Referrer's host, or null for none / same site / not http(s). */
export function referrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === ownHost.toLowerCase().replace(/^www\./, "")) return null;
    return host.slice(0, 253);
  } catch {
    return null;
  }
}

/** Do Not Track or Global Privacy Control: record nothing. Automated browsers are skipped too. */
export function optedOut(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean; webdriver?: boolean }, winDnt?: string | null): boolean {
  return nav.doNotTrack === "1" || nav.doNotTrack === "yes" || winDnt === "1" || nav.globalPrivacyControl === true || nav.webdriver === true;
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
/** YYYY-MM-DD in Bangkok time. */
export const dayOf = (d: Date | string) => dayFmt.format(typeof d === "string" ? new Date(d) : d);

/** The last `n` days ending today (Bangkok), oldest first. */
export function lastDays(n: number, now = new Date()): string[] {
  const today = dayOf(now);
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1, d - (n - 1 - i)));
    return t.toISOString().slice(0, 10);
  });
}

const top = (m: Map<string, number>, limit: number): Count[] =>
  [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);

/**
 * Aggregate raw views into what the admin page shows.
 * views = page views; visits = distinct (day, session). Referrers, devices and locales count visits.
 */
export function aggregate(views: PageView[], days: number, now = new Date()): VisitorStats {
  const range = lastDays(days, now);
  const inRange = new Set(range);
  const perDay = new Map(range.map((d) => [d, { views: 0, visits: new Set<string>() }]));
  const pages = new Map<string, number>();
  const refs = new Map<string, Set<string>>();
  const devices = new Map<string, Set<string>>();
  const locales = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, key: string, visit: string) => {
    if (!m.has(key)) m.set(key, new Set());
    m.get(key)!.add(visit);
  };

  for (const v of views) {
    const day = dayOf(v.at);
    if (!inRange.has(day)) continue;
    const visit = `${day}|${v.sid}`;
    const bucket = perDay.get(day)!;
    bucket.views++;
    bucket.visits.add(v.sid);
    pages.set(v.path, (pages.get(v.path) ?? 0) + 1);
    if (v.ref) add(refs, v.ref, visit);
    add(devices, v.device, visit);
    if (v.locale) add(locales, v.locale, visit);
  }
  const sizes = (m: Map<string, Set<string>>) => new Map([...m].map(([k, s]) => [k, s.size]));
  return {
    days: range.map((date) => ({ date, views: perDay.get(date)!.views, visits: perDay.get(date)!.visits.size })),
    topPages: top(pages, 10),
    referrers: top(sizes(refs), 10),
    devices: top(sizes(devices), 3),
    locales: top(sizes(locales), 5),
  };
}

/** Sum of the last `n` days of a stats range. */
export function sumLast(stats: VisitorStats, n: number): { views: number; visits: number } {
  return stats.days.slice(-n).reduce((s, d) => ({ views: s.views + d.views, visits: s.visits + d.visits }), { views: 0, visits: 0 });
}

/** A round axis maximum (1, 2, 5 × 10ⁿ) at or above `max`, and its tick values. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw)!;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
