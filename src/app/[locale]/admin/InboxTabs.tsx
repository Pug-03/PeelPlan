"use client";

import { Bug, Check, Copy, Lightbulb, Mail, MessageSquare, Monitor, RotateCcw, Smartphone, Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { listReports, setReportStatus, useAdminQuery, type AdminReport, type ReportStatus } from "@/features/admin/data";
import { FEEDBACK_EVENT, listFeedback, setFeedbackStatus } from "@/features/feedback/client";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type Feedback, type FeedbackKind, type FeedbackStatus } from "@/features/feedback/validate";
import { Link } from "@/i18n/navigation";
import { useDate } from "../seller/ui";
import { Empty, FilterChips, LoadError, Pill, Skeleton, type Tone } from "./ui";

const KIND_ICON: Record<FeedbackKind, typeof Bug> = { bug: Bug, idea: Lightbulb, other: MessageSquare };
const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;
const STATUS_TONE: Record<FeedbackStatus, Tone> = { new: "info", in_progress: "warn", done: "good" };

export type FeedbackFilter = FeedbackStatus | "all";

const selectClass =
  "h-9 rounded-full border border-hairline bg-bg px-3 text-sm outline-none transition-colors hover:border-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-[var(--focus)]";

export function FeedbackTab({ status, setStatus }: { status: FeedbackFilter; setStatus: (s: FeedbackFilter) => void }) {
  const t = useTranslations("admin.feedback");
  const ta = useTranslations("admin");
  const date = useDate();
  const q = useAdminQuery(listFeedback, [], [FEEDBACK_EVENT]);
  const [kind, setKind] = useState<FeedbackKind | "all">("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const all = q.data ?? [];
  const list = all.filter((f) => (status === "all" || f.status === status) && (kind === "all" || f.kind === kind));

  const change = async (f: Feedback, s: FeedbackStatus) => {
    setError(false);
    try {
      await setFeedbackStatus(f.id, s);
      q.reload();
    } catch {
      setError(true);
    }
  };
  const copy = async (f: Feedback) => {
    try {
      await navigator.clipboard.writeText(f.email ?? "");
      setCopied(f.id);
      setTimeout(() => setCopied((c) => (c === f.id ? null : c)), 2000);
    } catch {
      /* clipboard blocked: the address is visible to select by hand */
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips
          label={t("statusFilter")}
          options={["all", ...FEEDBACK_STATUSES] as const}
          value={status}
          onChange={setStatus}
          text={(k) => (k === "all" ? t("all") : t(`status.${k}`))}
          count={(k) => all.filter((f) => k === "all" || f.status === k).length}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          {t("kindFilter")}
          <select value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind | "all")} className={selectClass}>
            <option value="all">{t("all")}</option>
            {FEEDBACK_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDE2E2] px-4 py-3 text-sm text-[#8A1F24]">
          {ta("saveError")}
        </p>
      )}

      {q.error && !q.data ? (
        <LoadError text={ta("loadError")} retry={q.reload} retryLabel={ta("retry")} />
      ) : !q.data ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <Empty title={all.length ? t("noMatch") : t("empty")} body={all.length ? undefined : t("emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((f) => {
            const Kind = KIND_ICON[f.kind];
            const Device = DEVICE_ICON[f.device] ?? Monitor;
            return (
              <li key={f.id} className={`rounded-2xl border bg-bg p-4 sm:p-5 ${f.status === "new" ? "border-ink" : "border-hairline"}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Kind className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {t(`kinds.${f.kind}`)}
                  </span>
                  <Pill tone={STATUS_TONE[f.status]}>{t(`status.${f.status}`)}</Pill>
                  <span className="ml-auto text-xs text-muted tabular-nums">{date(f.createdAt)}</span>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed break-words whitespace-pre-line">{f.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="sr-only">{t("page")}:</span>
                    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink">{f.path}</code>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Device className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {ta(`devices.${f.device}`)}
                  </span>
                  <span>{f.locale.toUpperCase()}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                  {f.email ? (
                    <span className="mr-auto inline-flex min-w-0 items-center gap-2 text-sm">
                      <Mail className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
                      <span className="truncate select-all">{f.email}</span>
                      <button type="button" onClick={() => void copy(f)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink">
                        {copied === f.id ? <Check className="size-3.5" strokeWidth={2} aria-hidden="true" /> : <Copy className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
                        <span aria-live="polite">{copied === f.id ? t("copied") : t("copyEmail")}</span>
                      </button>
                    </span>
                  ) : (
                    <span className="mr-auto text-sm text-muted">{t("noEmail")}</span>
                  )}
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <span className="sr-only">{t("setStatus")}</span>
                    <select value={f.status} onChange={(e) => void change(f, e.target.value as FeedbackStatus)} className={selectClass} aria-label={t("setStatus")}>
                      {FEEDBACK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ReportsTab() {
  const t = useTranslations("admin.reports");
  const ta = useTranslations("admin");
  const tr = useTranslations("chat.report.reasons");
  const date = useDate();
  const q = useAdminQuery(listReports, []);
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [error, setError] = useState(false);
  const all = q.data ?? [];
  const list = all.filter((r) => filter === "all" || r.status === filter);
  const reason = (r: AdminReport) => (tr.has(r.reason) ? tr(r.reason) : r.reason);

  const change = async (r: AdminReport, s: ReportStatus) => {
    setError(false);
    try {
      await setReportStatus(r.id, s);
      q.reload();
    } catch {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <FilterChips
        label={t("filter")}
        options={["open", "handled", "all"] as const}
        value={filter}
        onChange={setFilter}
        text={(k) => t(`filters.${k}`)}
        count={(k) => all.filter((r) => k === "all" || r.status === k).length}
      />
      {error && (
        <p role="alert" className="rounded-xl bg-[#FDE2E2] px-4 py-3 text-sm text-[#8A1F24]">
          {ta("saveError")}
        </p>
      )}
      {q.error && !q.data ? (
        <LoadError text={ta("loadError")} retry={q.reload} retryLabel={ta("retry")} />
      ) : !q.data ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <Empty title={all.length ? t("noMatch") : t("empty")} body={all.length ? undefined : t("emptyBody")} />
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-bg">
          {list.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:p-5">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{reason(r)}</span>
                  <Pill tone={r.status === "open" ? "bad" : "good"}>{t(`filters.${r.status}`)}</Pill>
                  {r.side && <span className="text-xs text-muted">{t(`by.${r.side}`)}</span>}
                </div>
                {r.note ? <p className="text-sm leading-relaxed break-words whitespace-pre-line text-muted">{r.note}</p> : <p className="text-sm text-muted italic">{t("noNote")}</p>}
                <p className="text-xs text-muted tabular-nums">{date(r.at)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {r.threadId && (
                  <Link href={`/messages/${r.threadId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3 text-sm font-medium transition-colors hover:border-ink">
                    <MessageSquare className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {t("openThread")}
                  </Link>
                )}
                {r.status === "open" ? (
                  <button type="button" onClick={() => void change(r, "handled")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#D7FF3A] px-3.5 text-sm font-semibold text-[#111] hover:opacity-90">
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                    {t("markHandled")}
                  </button>
                ) : (
                  <button type="button" onClick={() => void change(r, "open")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3 text-sm font-medium transition-colors hover:border-ink">
                    <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {t("reopen")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
