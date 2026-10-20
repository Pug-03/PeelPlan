"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useSession, type Session } from "@/lib/session";

/** Messages need an account; signed-out visitors get a sign-in link that brings them back here. */
export function ChatGate({ children }: { children: (session: Session) => ReactNode }) {
  const state = useSession();
  const t = useTranslations("chat");
  const pathname = usePathname();

  if (state.status === "loading") return <div className="min-h-[60dvh]" aria-busy="true" />;
  if (state.status === "signed-out")
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 pt-16 pb-20 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-surface" aria-hidden="true">
          <MessageCircle className="size-6" strokeWidth={1.75} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{t("signInTitle")}</h1>
        <p className="text-muted">{t("signInBody")}</p>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-accent-ink">
          {t("signIn")}
        </Link>
      </div>
    );
  return <>{children(state.session)}</>;
}
