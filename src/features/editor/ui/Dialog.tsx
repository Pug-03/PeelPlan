"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/** Native <dialog> modal: focus trap, Esc to close, and inert background come from the platform. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  closeLabel?: string;
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
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-auto max-h-[92dvh] w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-bg p-0 text-ink shadow-[0_24px_80px_-20px_rgb(0_0_0/0.35)] backdrop:bg-black/35 backdrop:backdrop-blur-[2px] ${wide ? "max-w-4xl" : "max-w-lg"}`}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
