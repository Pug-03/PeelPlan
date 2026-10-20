import { describe, expect, it } from "vitest";
import { aggregate, cleanPath, dayOf, deviceClass, isTrackable, lastDays, niceTicks, optedOut, referrerHost, sumLast, type PageView } from "./stats";

describe("cleanPath", () => {
  it("splits the locale and drops query and hash", () => {
    expect(cleanPath("/th/shops?x=1#top")).toEqual({ path: "/shops", locale: "th" });
    expect(cleanPath("/en")).toEqual({ path: "/", locale: "en" });
    expect(cleanPath("/")).toEqual({ path: "/", locale: null });
  });
  it("collapses ids so private order / chat ids never land in stats", () => {
    expect(cleanPath("/th/orders/3f2a1b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c").path).toBe("/orders/:id");
    expect(cleanPath("/en/messages/demo-a1b2c3d4e5f6g7h8i9j0k1").path).toBe("/messages/:id");
    expect(cleanPath("/th/shops/studio-kluay").path).toBe("/shops/studio-kluay");
  });
  it("caps the length", () => {
    expect(cleanPath(`/th/${"a".repeat(500)}`).path.length).toBe(200);
  });
});

describe("tracking rules", () => {
  it("never counts admin pages", () => {
    expect(isTrackable("/admin")).toBe(false);
    expect(isTrackable("/admin/x")).toBe(false);
    expect(isTrackable("/administrator-guide")).toBe(true);
  });
  it("respects DNT, GPC and automation", () => {
    expect(optedOut({ doNotTrack: "1" })).toBe(true);
    expect(optedOut({}, "1")).toBe(true);
    expect(optedOut({ globalPrivacyControl: true })).toBe(true);
    expect(optedOut({ webdriver: true })).toBe(true);
    expect(optedOut({ doNotTrack: "0", globalPrivacyControl: false })).toBe(false);
  });
  it("classifies devices by viewport width", () => {
    expect(deviceClass(390)).toBe("mobile");
    expect(deviceClass(768)).toBe("tablet");
    expect(deviceClass(1280)).toBe("desktop");
  });
  it("keeps only the referring host, never our own", () => {
    expect(referrerHost("https://www.google.com/search?q=peelplan", "peelplan.app")).toBe("google.com");
    expect(referrerHost("https://peelplan.app/th", "peelplan.app")).toBeNull();
    expect(referrerHost("", "peelplan.app")).toBeNull();
    expect(referrerHost("android-app://com.line", "peelplan.app")).toBeNull();
    expect(referrerHost("not a url", "peelplan.app")).toBeNull();
  });
});

describe("days (Bangkok time)", () => {
  it("buckets by Asia/Bangkok, not UTC", () => {
    expect(dayOf("2026-10-19T18:30:00Z")).toBe("2026-10-20");
    expect(dayOf("2026-10-19T16:59:00Z")).toBe("2026-10-19");
  });
  it("lists the last n days ending today", () => {
    expect(lastDays(3, new Date("2026-03-01T05:00:00Z"))).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });
});

describe("aggregate", () => {
  const now = new Date("2026-10-20T05:00:00Z"); // 12:00 in Bangkok
  const v = (sid: string, at: string, extra: Partial<PageView> = {}): PageView => ({ path: "/", locale: "th", ref: null, device: "mobile", sid, at, ...extra });
  const views: PageView[] = [
    v("a", "2026-10-20T01:00:00Z", { ref: "google.com" }),
    v("a", "2026-10-20T01:01:00Z", { path: "/shops" }),
    v("a", "2026-10-20T01:02:00Z", { path: "/shops" }),
    v("b", "2026-10-20T02:00:00Z", { device: "desktop", locale: "en", ref: "facebook.com" }),
    v("a", "2026-10-19T03:00:00Z"), // same tab, previous day: a second visit
    v("c", "2026-09-01T03:00:00Z"), // out of range
  ];
  const s = aggregate(views, 7, now);

  it("counts views and distinct visits per day, with empty days", () => {
    expect(s.days).toHaveLength(7);
    expect(s.days.at(-1)).toEqual({ date: "2026-10-20", views: 4, visits: 2 });
    expect(s.days.at(-2)).toEqual({ date: "2026-10-19", views: 1, visits: 1 });
    expect(s.days[0].views).toBe(0);
    expect(sumLast(s, 7)).toEqual({ views: 5, visits: 3 });
    expect(sumLast(s, 1)).toEqual({ views: 4, visits: 2 });
  });
  it("ranks pages by views and breakdowns by visits", () => {
    expect(s.topPages).toEqual([
      { key: "/", count: 3 },
      { key: "/shops", count: 2 },
    ]);
    expect(s.referrers).toEqual([
      { key: "facebook.com", count: 1 },
      { key: "google.com", count: 1 },
    ]);
    expect(s.devices).toEqual([
      { key: "mobile", count: 2 },
      { key: "desktop", count: 1 },
    ]);
    expect(s.locales).toEqual([
      { key: "th", count: 2 },
      { key: "en", count: 1 },
    ]);
  });
  it("handles no data", () => {
    const e = aggregate([], 30, now);
    expect(e.days).toHaveLength(30);
    expect(sumLast(e, 30)).toEqual({ views: 0, visits: 0 });
    expect(e.topPages).toEqual([]);
  });
});

describe("niceTicks", () => {
  it("rounds the axis up to 1/2/5 steps", () => {
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(1)).toEqual([0, 0.5, 1]);
    expect(niceTicks(130)).toEqual([0, 50, 100, 150]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
