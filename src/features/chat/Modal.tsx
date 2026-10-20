"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * In-page modal on the native <dialog>: focus is trapped and Escape closes it for free.
 * `open` is controlled by the parent; closing from inside calls onClose.
 */
export function Modal({
  open,
  onClose,
  label,
  closeLabel,
  children,
  className = "w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-bg p-5 text-ink shadow-soft sm:p-6",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`m-auto max-h-[calc(100dvh-2rem)] overflow-auto border border-hairline backdrop:bg-black/50 ${className}`}
    >
      {open && (
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute -top-1 -right-1 z-10 grid size-9 place-items-center rounded-full bg-bg/80 text-muted transition-colors hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
