"use client";

/**
 * Admin-only data that isn't part of the marketplace store: chat reports, access check, and a small
 * load-and-refresh hook. Every Supabase call here is also guarded in the database (is_admin()), so
 * the client check only decides what to render.
 */
import { useCallback, useEffect, useState } from "react";
import { AUTH_ENABLED } from "@/lib/supabase/config";
import type { ChatReport } from "@/features/chat/ReportDialog";

export const REPORTS_KEY = "peelplan.reports.v1";
export const ADMIN_EVENT = "peelplan:admin";

export type ReportStatus = "open" | "handled";
export type AdminReport = { id: string; threadId: string | null; reason: string; note: string; side?: "buyer" | "shop"; at: string; status: ReportStatus };

async function sb() {
  const { createSupabaseBrowser } = await import("@/lib/supabase/client");
  const c = createSupabaseBrowser();
  if (!c) throw new Error("supabase-disabled");
  return c;
}

type LocalReport = ChatReport & { status?: ReportStatus };
const readLocal = (): LocalReport[] => {
  try {
    const list = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]") as LocalReport[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

/** Newest first. */
export async function listReports(): Promise<AdminReport[]> {
  if (!AUTH_ENABLED)
    return readLocal()
      .map((r) => ({ id: r.id, threadId: r.threadId, reason: r.reason, note: r.note, side: r.side, at: r.at, status: r.status ?? "open" }))
      .sort((a, b) => b.at.localeCompare(a.at));
  const { data, error } = await (await sb()).from("reports").select("id, thread_id, reason, note, status, created_at").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data as { id: string; thread_id: string | null; reason: string; note: string; status: ReportStatus; created_at: string }[]).map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    reason: r.reason,
    note: r.note,
    at: r.created_at,
    status: r.status,
  }));
}

export async function setReportStatus(id: string, status: ReportStatus): Promise<void> {
  if (!AUTH_ENABLED) {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(readLocal().map((r) => (r.id === id ? { ...r, status } : r))));
    window.dispatchEvent(new Event(ADMIN_EVENT));
    return;
  }
  const { error } = await (await sb()).from("reports").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  window.dispatchEvent(new Event(ADMIN_EVENT));
}

/**
 * Supabase: profiles.is_admin via the is_admin() RPC. Test mode: anyone signed in with the test
 * account (the page shows a banner saying real access needs is_admin).
 */
export function useIsAdmin(userId: string): boolean | undefined {
  const [ok, setOk] = useState<boolean | undefined>(AUTH_ENABLED ? undefined : true);
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let alive = true;
    void sb()
      .then((c) => c.rpc("is_admin"))
      .then(
        ({ data }) => alive && setOk(data === true),
        () => alive && setOk(false),
      );
    return () => {
      alive = false;
    };
  }, [userId]);
  return ok;
}

export type Loaded<T> = { data?: T; error?: string; reload: () => void };

/**
 * Load once, reload on demand, and (test mode) when another tab or this one changes local data.
 * `data` keeps the previous value while reloading so tables don't flash.
 */
export function useAdminQuery<T>(load: () => Promise<T>, deps: unknown[], events: string[] = []): Loaded<T> {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    load().then(
      (data) => alive && setState({ data }),
      (e: unknown) => alive && setState((s) => ({ data: s.data, error: e instanceof Error ? e.message : "error" })),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    const on = () => reload();
    const names = [ADMIN_EVENT, ...events];
    names.forEach((n) => window.addEventListener(n, on));
    window.addEventListener("storage", on);
    return () => {
      names.forEach((n) => window.removeEventListener(n, on));
      window.removeEventListener("storage", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, events.join("|")]);

  return { ...state, reload };
}
