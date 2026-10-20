/**
 * Site feedback ("found a problem or have an idea?"): types and validation shared by the form, the
 * test-mode store and the tests. The database repeats these rules in `submit_feedback()`
 * (supabase/migrations/0003_admin_analytics_feedback.sql).
 */
import type { Device } from "@/features/analytics/stats";

export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["new", "in_progress", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
/** Per tab session, per rolling hour. */
export const RATE_LIMIT = 5;

export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  path: string;
  device: Device;
  locale: string;
  sessionId: string;
  status: FeedbackStatus;
  createdAt: string;
};

export type FeedbackDraft = { kind: string; message: string; email: string };
export type FeedbackErrors = Partial<Record<"kind" | "message" | "email", "required" | "short" | "long" | "invalid">>;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function validateFeedback(d: FeedbackDraft): { ok: true; value: { kind: FeedbackKind; message: string; email: string | null } } | { ok: false; errors: FeedbackErrors } {
  const errors: FeedbackErrors = {};
  const message = d.message.trim();
  const email = d.email.trim();
  if (!(FEEDBACK_KINDS as readonly string[]).includes(d.kind)) errors.kind = "required";
  if (!message) errors.message = "required";
  else if ([...message].length < MESSAGE_MIN) errors.message = "short";
  else if ([...message].length > MESSAGE_MAX) errors.message = "long";
  if (email && (email.length > 254 || !EMAIL.test(email))) errors.email = "invalid";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { kind: d.kind as FeedbackKind, message, email: email || null } };
}

/** How many of `list` this session sent in the hour before `now`. */
export function recentFromSession(list: Pick<Feedback, "sessionId" | "createdAt">[], sessionId: string, now = Date.now()): number {
  return list.filter((f) => f.sessionId === sessionId && now - Date.parse(f.createdAt) < 3_600_000).length;
}
