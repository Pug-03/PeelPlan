"use client";

import { Bug, CheckCircle2, Lightbulb, MessageSquare, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { visitId } from "@/features/analytics/client";
import { cleanPath, deviceClass, type Device } from "@/features/analytics/stats";
import { TEST_MODE } from "@/features/market/store";
import { Link } from "@/i18n/navigation";
import { submitFeedback } from "./client";
import { FEEDBACK_KINDS, MESSAGE_MAX, MESSAGE_MIN, validateFeedback, type FeedbackErrors, type FeedbackKind } from "./validate";

const ICONS: Record<FeedbackKind, typeof Bug> = { bug: Bug, idea: Lightbulb, other: MessageSquare };

const field =
  "w-full rounded-xl border border-hairline bg-bg px-3.5 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-ink aria-[invalid=true]:border-[#E5484D]";

/**
 * "Found a problem or have an idea?" form for the bottom of main pages. Attaches the page path and
 * device class (shown to the sender), never the full URL. Bots: a hidden honeypot field and a
 * minimum fill time both end in a silent fake success.
 */
export function FeedbackSection({ className = "", fromPath }: { className?: string; fromPath?: string }) {
  const t = useTranslations("feedback");
  const locale = useLocale();
  const pathname = usePathname();
  const uid = useId();
  const [kind, setKind] = useState<FeedbackKind | "">("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [failure, setFailure] = useState<"rate" | "save" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const mountedAt = useRef(0);
  const doneRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    mountedAt.current = performance.now();
    const update = () => setDevice(deviceClass(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  // On the /feedback page, attach the page the visitor came from rather than /feedback itself.
  const path = cleanPath(fromPath || pathname || "/").path;
  const id = (k: string) => `${uid}-${k}`;
  const length = [...message.trim()].length;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    const honeypot = String(new FormData(e.currentTarget).get("website") ?? "");
    const r = validateFeedback({ kind, message, email });
    if (!r.ok) {
      setErrors(r.errors);
      if (r.errors.message) messageRef.current?.focus();
      return;
    }
    setErrors({});
    // Filled honeypot or a form "typed" faster than a person can: pretend it worked, store nothing.
    if (honeypot || e.timeStamp - mountedAt.current < 1500) return setDone(true);
    setBusy(true);
    try {
      await submitFeedback({ ...r.value, path, device, locale, sessionId: visitId() });
      setDone(true);
      setMessage("");
      setEmail("");
      setKind("");
    } catch (err) {
      setFailure(err instanceof Error && err.message === "rate-limited" ? "rate" : "save");
    } finally {
      setBusy(false);
    }
  };

  const describe = (k: "message" | "email", hint?: boolean) => (errors[k] ? id(`${k}-error`) : hint ? id(`${k}-hint`) : undefined);

  return (
    <section aria-labelledby={id("title")} className={`grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 ${className}`}>
      <div className="flex flex-col gap-3">
        <h2 id={id("title")} className="text-2xl leading-tight font-semibold tracking-tight text-balance text-ink">
          {t("title")}
        </h2>
        <p className="max-w-[40ch] leading-relaxed text-muted">{t("body")}</p>
      </div>

      {done ? (
        <div ref={doneRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-hairline bg-surface p-6 outline-none">
          <CheckCircle2 className="size-7 text-ink" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-lg font-semibold text-ink">{t("successTitle")}</p>
          <p className="max-w-[48ch] text-sm leading-relaxed text-muted">{t("successBody")}</p>
          {TEST_MODE && <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-muted">{t("testNote")}</p>}
          <button
            type="button"
            onClick={() => setDone(false)}
            className="mt-1 inline-flex h-10 items-center rounded-full border border-hairline px-4 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            {t("again")}
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <fieldset aria-describedby={errors.kind ? id("kind-error") : undefined}>
            <legend className="mb-2 text-sm font-medium text-ink">{t("kindLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_KINDS.map((k) => {
                const Icon = ICONS[k];
                return (
                  <label
                    key={k}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline bg-bg px-3.5 py-2 text-sm text-ink transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]"
                  >
                    <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {t(`kinds.${k}`)}
                  </label>
                );
              })}
            </div>
            {errors.kind && (
              <p id={id("kind-error")} className="mt-2 text-sm text-[#C62F35] dark:text-[#FF8A8E]">
                {t("errors.kind")}
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("message")} className="text-sm font-medium text-ink">
              {t("messageLabel")}
            </label>
            <textarea
              ref={messageRef}
              id={id("message")}
              name="message"
              rows={4}
              maxLength={MESSAGE_MAX + 200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={describe("message", true)}
              className={`${field} resize-y py-3 leading-relaxed`}
            />
            <div className="flex items-start justify-between gap-3 text-xs">
              {errors.message ? (
                <p id={id("message-error")} className="text-sm text-[#C62F35] dark:text-[#FF8A8E]">
                  {t(`errors.message.${errors.message}`, { min: MESSAGE_MIN, max: MESSAGE_MAX })}
                </p>
              ) : (
                <p id={id("message-hint")} className="text-muted">
                  {t("attached", { path, device: t(`devices.${device}`) })}
                </p>
              )}
              <span className={`shrink-0 tabular-nums ${length > MESSAGE_MAX ? "text-[#C62F35] dark:text-[#FF8A8E]" : "text-muted"}`} aria-hidden="true">
                {length}/{MESSAGE_MAX}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("email")} className="text-sm font-medium text-ink">
              {t("emailLabel")} <span className="font-normal text-muted">{t("optional")}</span>
            </label>
            <input
              id={id("email")}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describe("email", true)}
              className={`${field} h-11 sm:max-w-sm`}
            />
            {errors.email ? (
              <p id={id("email-error")} className="text-sm text-[#C62F35] dark:text-[#FF8A8E]">
                {t("errors.email")}
              </p>
            ) : (
              <p id={id("email-hint")} className="text-xs text-muted">
                {t("emailHint")}
              </p>
            )}
          </div>

          {/* Honeypot: hidden from people and assistive tech; bots tend to fill every field. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={id("website")}>{t("honeypot")}</label>
            <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[46ch] text-xs leading-relaxed text-muted">
              {t.rich("consent", {
                link: (chunks) => (
                  <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-ink">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#D7FF3A] px-5 text-sm font-semibold text-[#111] transition-opacity hover:opacity-90 disabled:opacity-50 sm:self-auto"
            >
              <Send className="size-4" strokeWidth={2} aria-hidden="true" />
              {busy ? t("sending") : t("submit")}
            </button>
          </div>
          {failure && (
            <p role="alert" className="rounded-xl bg-[#FDE2E2] px-3 py-2 text-sm text-[#8A1F24]">
              {t(`errors.${failure}`)}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
