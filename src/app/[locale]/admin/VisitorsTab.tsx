"use client";

import { FlaskConical } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { visitorStats } from "@/features/analytics/client";
import { sumLast, type Count } from "@/features/analytics/stats";
import { TEST_MODE } from "@/features/market/store";
import { useAdminQuery } from "@/features/admin/data";
import { cardClass } from "../seller/ui";
import { VisitsChart } from "./VisitsChart";
import { Empty, LoadError, Skeleton, TableBox, td, th, useNumber } from "./ui";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function VisitorsTab() {
  const t = useTranslations("admin.visitors");
  const ta = useTranslations("admin");
  const n = useNumber();
  const locale = useLocale();
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const [range, setRange] = useState<Range>(30);
  const q = useAdminQuery(() => visitorStats(range), [range]);
  const s = q.data;
  const total = s ? sumLast(s, range) : null;
  const busiest = s?.days.reduce((a, b) => (b.visits > a.visits ? b : a), s.days[0]);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={t("range")} className="inline-flex rounded-full border border-hairline p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className="h-9 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-ink aria-checked:bg-ink aria-checked:text-bg"
            >
              {t("days", { n: r })}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{t("timezone")}</p>
      </div>

      {TEST_MODE && (
        <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {t("testNote")}
        </p>
      )}

      {q.error && !s ? (
        <LoadError text={ta("loadError")} retry={q.reload} retryLabel={ta("retry")} />
      ) : !s || !total ? (
        <Skeleton h="h-80" />
      ) : total.views === 0 ? (
        <Empty title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [t("visits"), n(total.visits)],
              [t("views"), n(total.views)],
              [t("perVisit"), total.visits ? (total.views / total.visits).toFixed(1) : "–"],
              [t("avgDaily"), (total.visits / range).toFixed(1)],
            ].map(([k, v]) => (
              <div key={k} className={cardClass}>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <section className={cardClass} aria-labelledby="chart-title">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="chart-title" className="font-semibold">
                {t("chartTitle")}
              </h2>
              {busiest && busiest.visits > 0 && <p className="text-xs text-muted">{t("busiest", { date: dayLabel(busiest.date), n: busiest.visits })}</p>}
            </div>
            <VisitsChart days={s.days} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="pages-title" className="flex flex-col gap-3">
              <h2 id="pages-title" className="font-semibold">
                {t("topPages")}
              </h2>
              <RankTable label={t("topPages")} keyLabel={t("page")} valueLabel={t("views")} rows={s.topPages} total={total.views} empty={t("none")} mono />
            </section>
            <section aria-labelledby="refs-title" className="flex flex-col gap-3">
              <h2 id="refs-title" className="font-semibold">
                {t("referrers")}
              </h2>
              <RankTable label={t("referrers")} keyLabel={t("source")} valueLabel={t("visits")} rows={s.referrers} total={total.visits} empty={t("noReferrers")} />
            </section>
            <Split title={t("devices")} rows={s.devices} text={(k) => ta(`devices.${k}`)} />
            <Split title={t("locales")} rows={s.locales} text={(k) => (k === "th" ? "ไทย (th)" : k === "en" ? "English (en)" : k)} />
          </div>
        </>
      )}
    </div>
  );
}

function RankTable({ label, keyLabel, valueLabel, rows, total, empty, mono }: { label: string; keyLabel: string; valueLabel: string; rows: Count[]; total: number; empty: string; mono?: boolean }) {
  const n = useNumber();
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <TableBox label={label}>
      <table className="w-full min-w-[20rem] text-sm">
        <thead className="border-b border-hairline">
          <tr>
            <th scope="col" className={th}>
              {keyLabel}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {valueLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={`${td} max-w-[16rem]`}>
                <span className={`block truncate ${mono ? "font-mono text-[13px]" : ""}`} title={r.key}>
                  {r.key}
                </span>
                {/* Share of the total, as a thin bar under the label. */}
                <span className="mt-1.5 block h-1 rounded-full bg-surface" aria-hidden="true">
                  <span className="block h-full rounded-full bg-[#3D6BF5] dark:bg-[#7AA2FF]" style={{ width: `${Math.max(2, (r.count / Math.max(1, total)) * 100)}%` }} />
                </span>
              </td>
              <td className={`${td} text-right tabular-nums`}>{n(r.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableBox>
  );
}

function Split({ title, rows, text }: { title: string; rows: Count[]; text: (k: string) => string }) {
  const n = useNumber();
  const sum = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <section className={cardClass} aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => {
          const pct = Math.round((r.count / sum) * 100);
          return (
            <li key={r.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{text(r.key)}</span>
                <span className="text-muted tabular-nums">
                  {n(r.count)} · <span className="font-medium text-ink">{pct}%</span>
                </span>
              </div>
              <span className="block h-2 rounded-full bg-surface" aria-hidden="true">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(2, pct)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
