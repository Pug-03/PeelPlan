"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { niceTicks, type VisitorStats } from "@/features/analytics/stats";
import { useNumber } from "./ui";

const H = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 40 };

/**
 * Daily visits (bars) and page views (line) on one shared count axis, drawn to scale in SVG.
 * Hover or arrow keys move a crosshair; the same numbers are in the table below for screen readers.
 */
export function VisitsChart({ days }: { days: VisitorStats["days"] }) {
  const t = useTranslations("admin.visitors");
  const locale = useLocale();
  const n = useNumber();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const short = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const label = (d: string, f = short) => f.format(new Date(`${d}T00:00:00Z`));

  const max = Math.max(1, ...days.map((d) => Math.max(d.views, d.visits)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const step = iw / Math.max(1, days.length);
  const gap = step > 6 ? 2 : step > 3 ? 1 : 0;
  const barW = Math.max(1, Math.min(28, step - gap));
  const x = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => PAD.top + ih - (v / top) * ih;
  const line = days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.views).toFixed(1)}`).join(" ");
  // About one date label per 80 px, always including the last day.
  const every = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(iw / 80))));
  const xLabels = days.map((_, i) => i).filter((i) => (days.length - 1 - i) % every === 0);

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.floor((clientX - r.left - PAD.left) / step);
    setHover(i >= 0 && i < days.length ? i : null);
  };
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Escape") return setHover(null);
    if (!d) return;
    e.preventDefault();
    setHover((h) => Math.min(days.length - 1, Math.max(0, (h ?? days.length) + d)));
  };
  const hd = hover !== null ? days[hover] : null;
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover), 80), w - 80) : 0;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[#3D6BF5] dark:bg-[#7AA2FF]" aria-hidden="true" />
          {t("visits")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-ink" aria-hidden="true" />
          {t("views")}
        </span>
        <span className="text-xs text-muted">{t("chartHint")}</span>
      </figcaption>
      <div
        ref={box}
        className="relative touch-pan-y rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        tabIndex={0}
        role="img"
        aria-label={t("chartLabel", { days: days.length })}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block max-w-full" aria-hidden="true">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} className="stroke-hairline" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {n(v)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const h = (d.visits / top) * ih;
            if (!d.visits) return null;
            const r = Math.min(4, barW / 2, h);
            const x0 = x(i) - barW / 2;
            const y0 = PAD.top + ih - h;
            // Rounded top, square base on the axis.
            return (
              <path
                key={d.date}
                d={`M${x0},${PAD.top + ih}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${PAD.top + ih}Z`}
                className={`fill-[#3D6BF5] dark:fill-[#7AA2FF] ${hover !== null && hover !== i ? "opacity-45" : ""}`}
              />
            );
          })}
          <path d={line} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === days.length - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
              {label(days[i].date)}
            </text>
          ))}
          {hd && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="stroke-muted" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(hd.views)} r={4.5} className="fill-ink stroke-bg" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hd && (
          <div
            className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-xl border border-hairline bg-bg px-3 py-2 text-xs shadow-soft"
            style={{ left: tipLeft }}
            aria-live="polite"
          >
            <p className="font-medium whitespace-nowrap">{label(hd.date, long)}</p>
            <p className="whitespace-nowrap text-muted">
              {t("visits")} <span className="font-medium text-ink tabular-nums">{n(hd.visits)}</span> · {t("views")}{" "}
              <span className="font-medium text-ink tabular-nums">{n(hd.views)}</span>
            </p>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">{t("asTable")}</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("date")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("visits")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("views")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5">{label(d.date, long)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{n(d.visits)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{n(d.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
