"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/features/chat/Modal";
import { PRODUCT_TYPES } from "@/config/onboarding";
import type { OrderStatus } from "@/features/market/types";

export const fieldClass =
  "h-11 w-full rounded-xl border border-hairline bg-bg px-3.5 text-base outline-none transition-colors focus:border-ink aria-[invalid=true]:border-[#E5484D]";
export const primaryBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#D7FF3A] px-5 text-sm font-semibold text-[#111] transition-opacity hover:opacity-90 disabled:opacity-50";
export const secondaryBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-hairline px-5 text-sm font-medium transition-colors hover:border-ink disabled:opacity-50";
export const cardClass = "rounded-2xl border border-hairline bg-bg p-5 sm:p-6";

/** Label + control + hint or error, wired for screen readers through `${id}-hint` / `${id}-error`. */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-[#C62F35]">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export const ariaFor = (id: string, error?: string) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : `${id}-hint`,
});

export type UnsavedGuard = {
  /** The in-app link that was held back, if any. Render <UnsavedDialog> to ask about it. */
  pending: string | null;
  stay: () => void;
  leave: () => void;
};

/**
 * While `dirty`: closing or reloading the tab asks first (the browser shows its own wording), and a
 * click on any in-app link (the nav, the language switch) is held back so the page can ask instead
 * of dropping the form. Use the returned guard with <UnsavedDialog>.
 */
export function useUnsavedGuard(dirty: boolean): UnsavedGuard {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers still need returnValue set.
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      // Let modified clicks (new tab / window / download) and anything already handled through.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target instanceof Element ? e.target.closest("a[href]") : null) as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      // Same page (including a plain #anchor): nothing is lost.
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      setPending(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", warn);
    // Capture, so the click is caught before the router's own handler navigates.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return {
    pending,
    stay: () => setPending(null),
    leave: () => {
      const to = pending;
      setPending(null);
      // Already locale-prefixed (it came from a rendered link), so the plain router keeps it as it is.
      if (to) router.push(to);
    },
  };
}

/** Asks before following a link that would drop unsaved changes. Pair with useUnsavedGuard. */
export function UnsavedDialog({ guard }: { guard: UnsavedGuard }) {
  const t = useTranslations("seller.settings");
  return (
    <Modal open={!!guard.pending} onClose={guard.stay} label={t("unsavedTitle")} closeLabel={t("unsavedStay")}>
      <div className="flex flex-col gap-4">
        <div className="pr-10">
          <h2 className="text-lg font-semibold">{t("unsavedTitle")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t("unsavedBody")}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" autoFocus onClick={guard.stay} className={`${secondaryBtn} h-10`}>
            {t("unsavedStay")}
          </button>
          <button type="button" onClick={guard.leave} className="inline-flex h-10 items-center rounded-full bg-[#c62f35] px-4 text-sm font-medium text-white">
            {t("unsavedLeave")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function useMoney() {
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
  return (n: number) => nf.format(n);
}

export function useDate() {
  const locale = useLocale();
  const df = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (iso: string) => df.format(new Date(iso));
}

const PILL: Record<OrderStatus, string> = {
  awaiting_payment: "bg-surface text-muted",
  slip_submitted: "bg-[#FFF1C9] text-[#6B4E00]",
  paid: "bg-[#DCEBFF] text-[#123E80]",
  shipped: "bg-[#E6E0FF] text-[#3B2A85]",
  completed: "bg-[#DDF5E6] text-[#15603A]",
  cancelled: "bg-[#FDE2E2] text-[#8A1F24]",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const t = useTranslations("seller.status");
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${PILL[status]}`}>{t(status)}</span>;
}

export function TypeChips({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const t = useTranslations("seller");
  const ta = useTranslations("auth");
  return (
    <fieldset aria-describedby={error ? "types-error" : undefined}>
      <legend className="mb-2 text-sm font-medium">{t("settings.productTypes")}</legend>
      <div className="flex flex-wrap gap-2">
        {PRODUCT_TYPES.map((p) => (
          <label
            key={p}
            className="cursor-pointer rounded-full border border-hairline px-3.5 py-2 text-sm transition-colors has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]"
          >
            <input
              type="checkbox"
              checked={value.includes(p)}
              onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))}
              className="sr-only"
            />
            {ta(`products.${p}`)}
          </label>
        ))}
      </div>
      {error && (
        <p id="types-error" className="mt-2 text-sm text-[#C62F35]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
