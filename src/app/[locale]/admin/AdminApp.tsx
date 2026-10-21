"use client";

import { AlertTriangle, ArrowRight, Eye, FlaskConical, MessageSquareText, ShieldAlert, Store, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AuthGate } from "@/components/AuthGate";
import { listAdminActions, listReports, useAdminQuery, useIsAdmin } from "@/features/admin/data";
import { visitorStats } from "@/features/analytics/client";
import { sumLast } from "@/features/analytics/stats";
import { FEEDBACK_EVENT, listFeedback } from "@/features/feedback/client";
import { TEST_MODE, useMarket } from "@/features/market/store";
import type { AdminShop } from "@/features/market/types";
import { Link } from "@/i18n/navigation";
import type { Session } from "@/lib/session";
import { cardClass, useDate } from "../seller/ui";
import { FeedbackTab, ReportsTab, type FeedbackFilter } from "./InboxTabs";
import { ShopsTab, type ShopFilter } from "./ShopsTab";
import { VisitorsTab } from "./VisitorsTab";
import { useNumber } from "./ui";

const TABS = ["overview", "visitors", "shops", "feedback", "reports"] as const;
type Tab = (typeof TABS)[number];

export function AdminGate() {
  return <AuthGate>{(session) => <AdminAccess session={session} />}</AuthGate>;
}

function AdminAccess({ session }: { session: Session }) {
  const t = useTranslations("admin");
  const ok = useIsAdmin(session.user.id);
  if (ok === undefined) return <div className="mx-auto mt-6 h-64 max-w-6xl animate-pulse rounded-2xl bg-surface px-5" aria-busy="true" />;
  if (!ok)
    return (
      <div className="mx-auto max-w-xl px-5 pt-16 pb-24 sm:px-8">
        <div className={`${cardClass} flex flex-col items-start gap-3`}>
          <ShieldAlert className="size-7" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-xl font-semibold">{t("denied.title")}</h1>
          <p className="text-sm leading-relaxed text-muted">{t("denied.body")}</p>
          <Link href="/" className="mt-2 text-sm font-medium underline underline-offset-4">
            {t("denied.home")}
          </Link>
        </div>
      </div>
    );
  return <Admin />;
}

function Admin() {
  const t = useTranslations("admin");
  const [tab, setTabState] = useState<Tab>("overview");
  const [shopFilter, setShopFilter] = useState<ShopFilter>("all");
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>("all");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // The tab lives in the hash (#shops) so it survives reloads and can be linked.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Tab;
      if ((TABS as readonly string[]).includes(h)) setTabState(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const setTab = (k: Tab) => {
    setTabState(k);
    history.replaceState(null, "", k === "overview" ? window.location.pathname : `#${k}`);
  };

  const shops = useMarket((s) => s.listAllShops?.() ?? Promise.resolve([] as AdminShop[]), []);
  const feedback = useAdminQuery(listFeedback, [], [FEEDBACK_EVENT]);
  const reports = useAdminQuery(listReports, []);
  const pending = shops?.filter((s) => s.status === "pending").length;
  const newFeedback = feedback.data?.filter((f) => f.status === "new").length;
  const openReports = reports.data?.filter((r) => r.status === "open").length;
  const badge: Partial<Record<Tab, number | undefined>> = { shops: pending, feedback: newFeedback, reports: openReports };

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + TABS.length) % TABS.length;
    setTab(TABS[n]);
    tabRefs.current[n]?.focus();
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-6 pb-20 sm:px-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("eyebrow")}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
      </header>

      {TEST_MODE && (
        <div className="flex items-start gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <p>
            <strong className="font-semibold">{t("testTitle")}</strong> {t("testBody")}
          </p>
        </div>
      )}

      <div role="tablist" aria-label={t("title")} className="-mx-5 flex gap-1 overflow-x-auto border-b border-hairline px-5 sm:mx-0 sm:px-0">
        {TABS.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`admin-tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`admin-panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            onKeyDown={(e) => onKey(e, i)}
            className="relative inline-flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:text-ink aria-selected:text-ink aria-selected:after:absolute aria-selected:after:inset-x-3 aria-selected:after:-bottom-px aria-selected:after:h-0.5 aria-selected:after:rounded-full aria-selected:after:bg-ink"
          >
            {t(`tabs.${k}`)}
            {!!badge[k] && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#D7FF3A] px-1.5 text-[11px] font-semibold text-[#111] tabular-nums">
                {badge[k]}
                <span className="sr-only"> {t("needsAttention")}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
        {tab === "overview" && (
          <Overview
            pending={pending}
            newFeedback={newFeedback}
            openReports={openReports}
            go={(k, f) => {
              if (k === "shops") setShopFilter((f as ShopFilter) ?? "all");
              if (k === "feedback") setFeedbackFilter((f as FeedbackFilter) ?? "all");
              setTab(k);
            }}
          />
        )}
        {tab === "visitors" && <VisitorsTab />}
        {tab === "shops" && <ShopsTab filter={shopFilter} setFilter={setShopFilter} />}
        {tab === "feedback" && <FeedbackTab status={feedbackFilter} setStatus={setFeedbackFilter} />}
        {tab === "reports" && <ReportsTab />}
      </div>
    </div>
  );
}

function Overview({ pending, newFeedback, openReports, go }: { pending?: number; newFeedback?: number; openReports?: number; go: (k: Tab, filter?: string) => void }) {
  const t = useTranslations("admin.overview");
  const n = useNumber();
  const stats = useAdminQuery(() => visitorStats(30), []);
  const s = stats.data;
  const v = (k: number) => (s ? n(sumLast(s, k).visits) : "–");

  const needs = [
    { key: "pendingShops", value: pending, icon: Store, onClick: () => go("shops", "pending") },
    { key: "newFeedback", value: newFeedback, icon: MessageSquareText, onClick: () => go("feedback", "new") },
    { key: "openReports", value: openReports, icon: AlertTriangle, onClick: () => go("reports") },
  ] as const;
  const traffic = [
    { key: "today", value: v(1), icon: Users },
    { key: "week", value: v(7), icon: Users },
    { key: "month", value: v(30), icon: Users },
    { key: "views", value: s ? n(sumLast(s, 30).views) : "–", icon: Eye },
  ] as const;

  return (
    <div className="flex flex-col gap-8 pt-2">
      <section aria-labelledby="needs-title" className="flex flex-col gap-3">
        <h2 id="needs-title" className="text-sm font-medium text-muted">
          {t("needsAction")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {needs.map(({ key, value, icon: Icon, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className={`group flex items-center gap-4 rounded-2xl border bg-bg p-5 text-left transition-shadow hover:shadow-soft ${value ? "border-ink" : "border-hairline"}`}
            >
              <span className={`grid size-11 shrink-0 place-items-center rounded-full ${value ? "bg-[#D7FF3A] text-[#111]" : "bg-surface text-muted"}`} aria-hidden="true">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-3xl font-semibold tabular-nums">{value === undefined ? "–" : n(value)}</span>
                <span className="text-sm text-muted">{t(key)}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="traffic-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="traffic-title" className="text-sm font-medium text-muted">
            {t("traffic")}
          </h2>
          <button type="button" onClick={() => go("visitors")} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
            {t("allStats")}
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {traffic.map(({ key, value, icon: Icon }) => (
            <button key={key} type="button" onClick={() => go("visitors")} className={`${cardClass} text-left transition-shadow hover:shadow-soft`}>
              <Icon className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />
              <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              <p className="text-sm text-muted">{t(key)}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{TEST_MODE ? t("trafficNoteTest") : t("trafficNote")}</p>
      </section>

      <StaffLog />
    </div>
  );
}

/**
 * The audit trail (0005 `admin_actions`): who approved, rejected, suspended or hid what, and why.
 * Hidden when there is nothing to show, which includes test mode and databases before 0005.
 */
function StaffLog() {
  const t = useTranslations("admin.staffLog");
  const date = useDate();
  const q = useAdminQuery(() => listAdminActions(20), []);
  if (!q.data?.length) return null;
  return (
    <section aria-labelledby="stafflog-title" className="flex flex-col gap-3">
      <h2 id="stafflog-title" className="text-sm font-medium text-muted">
        {t("title")}
      </h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-bg">
        {q.data.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5 text-sm">
            <span className="font-medium">{t.has(`actions.${a.action}`) ? t(`actions.${a.action}`) : a.action}</span>
            <span className="text-muted">{t.has(`targets.${a.targetType}`) ? t(`targets.${a.targetType}`) : a.targetType}</span>
            {a.newStatus && (
              <span className="text-muted">
                {a.oldStatus ? `${a.oldStatus} → ${a.newStatus}` : a.newStatus}
              </span>
            )}
            {a.reason && <span className="min-w-0 basis-full break-words text-muted">{a.reason}</span>}
            <span className="ml-auto text-xs text-muted tabular-nums">{date(a.at)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("note")}</p>
    </section>
  );
}
