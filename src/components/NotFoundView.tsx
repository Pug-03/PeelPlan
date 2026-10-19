import type { ReactNode } from "react";

/** 404 body: a dashed "where the sticker was" outline, the message, then the way back. */
export function NotFoundView({ title, body, actions }: { title: ReactNode; body: ReactNode; actions: ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-3xl flex-col items-center justify-center gap-8 px-5 py-16 text-center sm:px-8">
      <div
        aria-hidden="true"
        className="grid h-28 w-44 rotate-[-4deg] place-items-center rounded-[1.75rem] border-2 border-dashed border-hairline text-muted sm:h-32 sm:w-52"
      >
        <span className="editorial-italic text-6xl leading-none tabular-nums sm:text-7xl">404</span>
      </div>
      <div className="flex flex-col items-center gap-4">
        <h1 className="max-w-[20ch] text-balance text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{title}</h1>
        <p className="max-w-[46ch] text-lg leading-relaxed text-muted">{body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>
    </section>
  );
}

export const notFoundPrimary =
  "inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-accent-ink transition-transform duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5";
export const notFoundSecondary = "inline-flex h-12 items-center rounded-full px-5 font-medium text-ink transition-colors hover:bg-surface";
