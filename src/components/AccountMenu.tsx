"use client";

import { LayoutGrid, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { signOut, useSession } from "@/lib/session";

/** "Sign in" link, or the signed-in person's avatar with a menu (collection, sign out). */
export function AccountMenu() {
  const t = useTranslations("auth");
  const tc = useTranslations("collection");
  const router = useRouter();
  const state = useSession();
  const menu = useRef<HTMLDetailsElement>(null);

  // Close on Escape (returning focus) or a click outside.
  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [state.status]);

  // Fixed-width placeholder while the session loads, so the header doesn't shift.
  if (state.status === "loading") return <span className="inline-block h-9 w-20" aria-hidden="true" />;
  if (state.status === "signed-out")
    return (
      <Link href="/login" className="rounded-full px-2 py-2 text-sm font-medium whitespace-nowrap text-ink transition-colors hover:bg-surface sm:px-3">
        {t("signIn")}
      </Link>
    );

  const { user, profile, demo } = state.session;
  const name = profile?.displayName || user.name;
  return (
    <details ref={menu} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center rounded-full p-1 hover:bg-surface [&::-webkit-details-marker]:hidden"
        aria-label={t("account")}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink">{name.slice(0, 1).toUpperCase()}</span>
        )}
      </summary>
      <div className="absolute right-0 z-50 mt-2 flex w-60 origin-top-right animate-[fade-up_200ms_var(--ease-out-soft)] flex-col rounded-2xl border border-hairline bg-bg p-2 shadow-soft">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted">
            {user.email}
            {demo && ` · ${t("demoTitle")}`}
          </p>
        </div>
        <Link
          href="/collection"
          onClick={() => menu.current && (menu.current.open = false)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface"
        >
          <LayoutGrid className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {tc("title")}
        </Link>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            if (menu.current) menu.current.open = false;
            router.push("/");
            router.refresh();
          }}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-ink"
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {t("signOut")}
        </button>
      </div>
    </details>
  );
}
