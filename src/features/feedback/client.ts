"use client";

/**
 * Feedback storage. Test mode: this browser's localStorage. Supabase: insert through the
 * `submit_feedback` RPC (anyone, validated + rate-limited in the database); only admins can read
 * the `feedback` table or change a row's status (RLS).
 */
import { AUTH_ENABLED } from "@/lib/supabase/config";
import type { Device } from "@/features/analytics/stats";
import { RATE_LIMIT, recentFromSession, type Feedback, type FeedbackKind, type FeedbackStatus } from "./validate";

export const FEEDBACK_KEY = "peelplan.feedback.v1";
export const FEEDBACK_EVENT = "peelplan:feedback";
const MAX_LOCAL = 500;

export function readLocalFeedback(): Feedback[] {
  try {
    const list = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]") as Feedback[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function writeLocal(list: Feedback[]) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-MAX_LOCAL)));
  window.dispatchEvent(new Event(FEEDBACK_EVENT));
}

async function sb() {
  const { createSupabaseBrowser } = await import("@/lib/supabase/client");
  const c = createSupabaseBrowser();
  if (!c) throw new Error("supabase-disabled");
  return c;
}

export type FeedbackInput = { kind: FeedbackKind; message: string; email: string | null; path: string; device: Device; locale: string; sessionId: string };

/** Throws 'rate-limited' or 'save-failed'. */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  if (!AUTH_ENABLED) {
    const list = readLocalFeedback();
    if (recentFromSession(list, input.sessionId) >= RATE_LIMIT) throw new Error("rate-limited");
    try {
      writeLocal([...list, { ...input, id: crypto.randomUUID(), status: "new", createdAt: new Date().toISOString() }]);
    } catch {
      throw new Error("save-failed");
    }
    return;
  }
  const { error } = await (
    await sb()
  ).rpc("submit_feedback", {
    p_kind: input.kind,
    p_message: input.message,
    p_email: input.email,
    p_path: input.path,
    p_device: input.device,
    p_locale: input.locale,
    p_session_id: input.sessionId,
  });
  if (error) throw new Error(/rate-limited/.test(error.message) ? "rate-limited" : "save-failed");
}

type FeedbackRow = {
  id: string;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  path: string;
  device: Device;
  locale: string;
  session_id: string;
  status: FeedbackStatus;
  created_at: string;
};

/** Newest first. Admin only in Supabase mode. */
export async function listFeedback(): Promise<Feedback[]> {
  if (!AUTH_ENABLED) return readLocalFeedback().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data, error } = await (await sb()).from("feedback").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data as FeedbackRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    email: r.email,
    path: r.path,
    device: r.device,
    locale: r.locale,
    sessionId: r.session_id,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  if (!AUTH_ENABLED) {
    writeLocal(readLocalFeedback().map((f) => (f.id === id ? { ...f, status } : f)));
    return;
  }
  const { error } = await (await sb()).from("feedback").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  window.dispatchEvent(new Event(FEEDBACK_EVENT));
}
