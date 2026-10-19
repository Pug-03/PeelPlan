"use client";

import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { afterAuthPath, safePath } from "@/lib/safe-path";
import { signInDemo, useSession, type Session } from "@/lib/session";

/** Next step after the simulated sign-in: the profile form first, then `next`. */
const destination = (s: Session, next?: string) =>
  s.profile ? afterAuthPath(next) : `/onboarding?preview=1&next=${encodeURIComponent(safePath(next, ""))}`;

/** Local testing only: acts as if Google sign-in succeeded, then continues to the profile form. */
export function DemoSignIn({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const state = useSession();

  // Signed in (just now, or earlier on this device via a bookmarked /login): move on. Replace, so
  // Back doesn't return to the sign-in page.
  useEffect(() => {
    if (state.status === "signed-in") router.replace(destination(state.session, next));
  }, [state, next, router]);

  return (
    <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-dashed border-hairline p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted">
        <FlaskConical className="size-3.5" strokeWidth={2} aria-hidden="true" />
        {t("demoTitle")}
      </p>
      <button
        type="button"
        disabled={state.status !== "signed-out"}
        onClick={() => signInDemo()}
        className="h-11 rounded-full bg-ink text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {t("demoButton")}
      </button>
      <p className="text-xs leading-relaxed text-muted">{t("demoNote")}</p>
    </div>
  );
}
