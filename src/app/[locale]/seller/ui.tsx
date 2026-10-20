"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
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
