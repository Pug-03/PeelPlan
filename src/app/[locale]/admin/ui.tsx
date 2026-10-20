"use client";

import { Inbox } from "lucide-react";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";

/** Shared bits for the admin tabs. Layout helpers (cardClass, buttons, fields) come from ../seller/ui. */

export type Tone = "neutral" | "warn" | "good" | "bad" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-muted",
  warn: "bg-[#FFF1C9] text-[#6B4E00]",
  good: "bg-[#DDF5E6] text-[#15603A]",
  bad: "bg-[#FDE2E2] text-[#8A1F24]",
  info: "bg-[#DCEBFF] text-[#123E80]",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline px-5 py-12 text-center">
      <Inbox className="size-6 text-muted" strokeWidth={1.5} aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
    </div>
  );
}

export function Skeleton({ h = "h-40" }: { h?: string }) {
  return <div className={`${h} animate-pulse rounded-2xl bg-surface`} aria-busy="true" />;
}

export function LoadError({ text, retry, retryLabel }: { text: string; retry: () => void; retryLabel: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#FDE2E2] px-4 py-3 text-sm text-[#8A1F24]">
      <span className="mr-auto">{text}</span>
      <button type="button" onClick={retry} className="font-medium underline underline-offset-4">
        {retryLabel}
      </button>
    </div>
  );
}

/** Toggle-button group used as a filter (aria-pressed), with optional counts. */
export function FilterChips<K extends string>({
  label,
  options,
  value,
  onChange,
  text,
  count,
}: {
  label: string;
  options: readonly K[];
  value: K;
  onChange: (k: K) => void;
  text: (k: K) => string;
  count?: (k: K) => number;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {options.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3.5 py-2 text-sm whitespace-nowrap transition-colors hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
        >
          {text(k)}
          {count && <span className="tabular-nums opacity-70">{count(k)}</span>}
        </button>
      ))}
    </div>
  );
}

/** Tables scroll sideways inside their own box on narrow screens; the page never does. */
export function TableBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-2xl border border-hairline bg-bg focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
      {children}
    </div>
  );
}
export const th = "px-4 py-3 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted uppercase";
export const td = "px-4 py-3 align-middle";

export function useDay() {
  const locale = useLocale();
  const df = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (iso: string) => df.format(new Date(iso));
}

export function useNumber() {
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");
  return (n: number) => nf.format(n);
}
