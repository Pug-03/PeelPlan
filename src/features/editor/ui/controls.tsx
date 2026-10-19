"use client";

import { useState } from "react";

export function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-9 shrink-0 place-items-center rounded-lg text-ink transition-[background,color,transform] duration-150 hover:bg-surface-2 active:scale-90 disabled:pointer-events-none disabled:opacity-35 aria-pressed:bg-ink aria-pressed:text-bg ${className}`}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:brightness-105",
    dark: "bg-ink text-bg hover:opacity-90",
    secondary: "border border-hairline bg-bg text-ink hover:bg-surface",
    ghost: "text-ink hover:bg-surface",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-[background,filter,opacity,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/** Numeric mm input that commits on blur/Enter so typing "1" on the way to "12" doesn't jump the sticker. */
export function NumberField({
  label,
  value,
  onCommit,
  unit = "mm",
  step = 0.5,
  min,
  max,
  digits = 1,
  disabled,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  digits?: number;
  disabled?: boolean;
}) {
  const shown = Number.isFinite(value) ? String(Math.round(value * 10 ** digits) / 10 ** digits) : "";
  const [draft, setDraft] = useState(shown);
  const [prevShown, setPrevShown] = useState(shown);
  if (shown !== prevShown) {
    setPrevShown(shown);
    setDraft(shown);
  }
  const commit = () => {
    const v = Number(draft.replace(",", "."));
    if (!Number.isFinite(v)) return setDraft(shown);
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
    if (clamped !== value) onCommit(clamped);
    setDraft(String(Math.round(clamped * 10 ** digits) / 10 ** digits));
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex h-10 items-center rounded-lg border border-hairline bg-bg px-3 focus-within:border-ink">
        <input
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              const v = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + d));
              onCommit(v);
            }
          }}
          className="w-full min-w-0 bg-transparent text-sm tabular-nums outline-none disabled:opacity-50"
        />
        <span className="pl-2 text-xs text-muted">{unit}</span>
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="flex-1 rounded-full px-2.5 py-1.5 text-[0.8125rem] whitespace-nowrap text-muted transition-colors aria-checked:bg-bg aria-checked:text-ink aria-checked:shadow-sm"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-10 shrink-0 rounded-full bg-surface-2 transition-colors aria-checked:bg-ink"
      >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-bg shadow transition-transform duration-200 ${checked ? "translate-x-4" : ""}`} />
      </button>
    </label>
  );
}
