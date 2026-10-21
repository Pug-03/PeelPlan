"use client";

/**
 * Admin-only data that isn't part of the marketplace store: chat reports, access check, and a small
 * load-and-refresh hook. Every Supabase call here is also guarded in the database (is_admin()), so
 * the client check only decides what to render.
 */
import { useCallback, useEffect, useState } from "react";
import { getStore } from "@/features/market/store";
import type { Thread } from "@/features/market/types";
import { AUTH_ENABLED } from "@/lib/supabase/config";
import type { ChatReport } from "@/features/chat/ReportDialog";

export const REPORTS_KEY = "peelplan.reports.v1";
export const ADMIN_EVENT = "peelplan:admin";

export type ReportStatus = "open" | "handled";
export type AdminReport = {
  id: string;
  threadId: string | null;
  reason: string;
  note: string;
  /** Which side of the conversation reported it. */
  side?: "buyer" | "shop";
  at: string;
  status: ReportStatus;
  /** Who the reported conversation is between (missing when the thread or the shop is gone). */
  shopName?: string;
  buyerName?: string;
};

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

/** A report row plus whatever the report itself knows about the conversation (see `addContext`). */
type Raw = AdminReport & { reporterId?: string; shopId?: string; buyerId?: string };

/** The first of `names` the row actually has, so a newer `file_report` snapshot is used when present. */
function col(row: Record<string, unknown>, names: string[]): string | undefined {
  for (const n of names) {
    const v = row[n];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

/**
 * Who the reported conversation is between, so staff can judge a report without opening it.
 * The thread is readable here (admins may read reported threads, 0003) and names come from the admin
 * shop list, which also covers shops that are no longer public. Ids the report row carries itself
 * (the `file_report` snapshot) are the fallback when the thread is gone.
 */
async function addContext(reports: Raw[]): Promise<AdminReport[]> {
  const s = await getStore();
  const threads = new Map<string, Thread | null>();
  const shopNames = new Map<string, string>();
  await Promise.all([
    ...[...new Set(reports.flatMap((r) => (r.threadId ? [r.threadId] : [])))].map(async (id) =>
      threads.set(id, await s.getThread(id).catch(() => null)),
    ),
    (async () => {
      for (const shop of (await s.listAllShops?.().catch(() => [])) ?? []) shopNames.set(shop.id, shop.name);
    })(),
  ]);

  return reports.map(({ reporterId, shopId, buyerId, ...r }) => {
    const thread = r.threadId ? threads.get(r.threadId) : null;
    const shop = thread?.shopId ?? shopId;
    const buyer = thread?.buyerId ?? buyerId;
    return {
      ...r,
      shopName: shop ? shopNames.get(shop) : undefined,
      buyerName: thread?.buyerName || undefined,
      side: r.side ?? (reporterId && buyer ? (reporterId === buyer ? "buyer" : "shop") : undefined),
    };
  });
}

/** Newest first. */
export async function listReports(): Promise<AdminReport[]> {
  if (!AUTH_ENABLED)
    return addContext(
      readLocal()
        .map((r) => ({ id: r.id, threadId: r.threadId, reason: r.reason, note: r.note, side: r.side, at: r.at, status: r.status ?? "open" }))
        .sort((a, b) => b.at.localeCompare(a.at)),
    );
  // Every column: `file_report` (0005) stores the reported shop and buyer on the row, and older
  // databases simply don't have those columns.
  const { data, error } = await (await sb()).from("reports").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (Record<string, unknown> & { id: string; thread_id: string | null; reason: string; note: string; status: ReportStatus; created_at: string })[];
  return addContext(
    rows.map((r) => ({
      id: r.id,
      threadId: r.thread_id,
      reason: r.reason,
      note: r.note,
      at: r.created_at,
      status: r.status,
      reporterId: col(r, ["reporter_id"]),
      shopId: col(r, ["reported_shop_id", "shop_id"]),
      buyerId: col(r, ["reported_buyer_id", "buyer_id"]),
    })),
  );
}

/**
 * What staff may know about an order (0005 `admin_order_summary`): status, totals and the code, and
 * deliberately no address, phone, slip or PromptPay. `null` before 0005, or if the order is gone.
 */
export type AdminOrder = { id: string; code: string; status: string; totalThb: number; itemCount: number; at: string };

export async function adminOrderSummary(orderId: string): Promise<AdminOrder | null> {
  if (!AUTH_ENABLED) return null;
  const { data, error } = await (await sb()).rpc("admin_order_summary", { p_order_id: orderId });
  if (error || !data) return null;
  const o = data as { id: string; code: string; status: string; total_thb: number | string; item_count: number | string; created_at: string };
  return { id: o.id, code: o.code, status: o.status, totalThb: Number(o.total_thb), itemCount: Number(o.item_count), at: o.created_at };
}

/** One entry from the staff audit trail (0005 `admin_actions`). */
export type AdminAction = {
  id: string;
  action: string;
  targetType: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  at: string;
};

/**
 * What staff changed lately: who approved, rejected, suspended or hid what, and why. Admin-readable
 * only. Empty in test mode and before 0005 (no such table).
 */
export async function listAdminActions(limit = 20): Promise<AdminAction[]> {
  if (!AUTH_ENABLED) return [];
  const { data, error } = await (await sb())
    .from("admin_actions")
    .select("id, action, target_type, old_status, new_status, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/does not exist|schema cache|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as { id: number | string; action: string; target_type: string; old_status: string | null; new_status: string | null; reason: string | null; created_at: string }[]).map(
    (r) => ({
      id: String(r.id),
      action: r.action,
      targetType: r.target_type,
      oldStatus: r.old_status ?? undefined,
      newStatus: r.new_status ?? undefined,
      reason: r.reason ?? undefined,
      at: r.created_at,
    }),
  );
}

/** One message as it was when the report was filed (0005 `report_messages`). */
export type ReportMessage = { id: string; from: string; text: string; at: string; hasImage: boolean };

/**
 * The evidence snapshot for a report: the conversation as it stood when it was reported, so it
 * survives the reported account deleting itself. Empty in test mode and before 0005 (no such table);
 * the queue falls back to opening the live conversation.
 */
export async function listReportMessages(reportId: string): Promise<ReportMessage[]> {
  if (!AUTH_ENABLED) return [];
  const { data, error } = await (await sb())
    .from("report_messages")
    .select("id, sender, body, image_path, created_at")
    .eq("report_id", reportId)
    .order("created_at")
    .limit(500);
  // Older database: no snapshot table. Anything else is a real failure worth showing.
  if (error) {
    if (/does not exist|schema cache|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as { id: number | string; sender: string; body: string | null; image_path: string | null; created_at: string }[]).map((m) => ({
    id: String(m.id),
    from: m.sender,
    text: m.body ?? "",
    at: m.created_at,
    hasImage: !!m.image_path,
  }));
}

/**
 * Whether the signed-in staff member may read this conversation: they are an admin and someone
 * reported the thread. Supabase grants exactly that much (0003 "threads/messages: admins read
 * reported"); in test mode reports live on this device.
 */
export async function canAdminReadThread(threadId: string): Promise<boolean> {
  if (!AUTH_ENABLED) return readLocal().some((r) => r.threadId === threadId);
  try {
    const c = await sb();
    const [admin, reported] = await Promise.all([c.rpc("is_admin"), c.rpc("thread_is_reported", { p_thread_id: threadId })]);
    return admin.data === true && reported.data === true;
  } catch {
    return false;
  }
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
