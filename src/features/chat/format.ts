const lang = (locale: string) => (locale === "th" ? "th-TH" : "en-GB");

/** "5 minutes ago", "yesterday"… */
export function relativeTime(iso: string, locale: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "th" ? "th" : "en", { numeric: "auto", style: "short" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
  ];
  let v = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(v) < size) return unit === "second" ? rtf.format(0, "minute") : rtf.format(Math.round(v), unit);
    v /= size;
  }
  return rtf.format(Math.round(v), "year");
}

export const timeOfDay = (iso: string, locale: string) => new Intl.DateTimeFormat(lang(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Local calendar day, used to group messages. */
export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function dayLabel(iso: string, locale: string, words: { today: string; yesterday: string }) {
  const k = dayKey(iso);
  if (k === dayKey(new Date().toISOString())) return words.today;
  if (k === dayKey(new Date(Date.now() - 864e5).toISOString())) return words.yesterday;
  return new Intl.DateTimeFormat(lang(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export const baht = (n: number, locale: string) => n.toLocaleString(lang(locale));

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
