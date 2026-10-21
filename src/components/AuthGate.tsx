"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { retrySession, useSession, type Session } from "@/lib/session";
import { useEffect, type ReactNode } from "react";

/**
 * Everyone signs in with Google before using the app. Signed-out visitors go to /login and come
 * back here afterwards; signed-in people who haven't finished the profile form go to onboarding.
 * If the session or profile couldn't be loaded, nobody is redirected: a Retry is offered instead.
 */
export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const state = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const failed = (state.status === "loading" && state.failed) || (state.status === "signed-in" && state.profileError);

  useEffect(() => {
    if (state.status === "loading" || failed) return;
    // Keep the hash too: a share link (#s=…) must survive the trip through sign-in.
    const back = encodeURIComponent(pathname + window.location.search + window.location.hash);
    if (state.status === "signed-out") router.replace(`/login?next=${back}`);
    else if (!state.session.profile) router.replace(`/onboarding?${state.session.demo ? "preview=1&" : ""}next=${back}`);
  }, [state, failed, router, pathname]);

  if (failed) return <SessionError />;
  if (state.status !== "signed-in" || !state.session.profile) return <SessionWait slow={state.status === "loading" && !!state.slow} />;
  return <>{children(state.session)}</>;
}

/** Blank while the lookup is quick; a line of reassurance once it drags (see SLOW_AFTER in session.ts). */
function SessionWait({ slow }: { slow: boolean }) {
  const t = useTranslations("auth");
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-5" aria-busy="true">
      {slow && (
        <p role="status" className="text-sm text-muted">
          {t("stillLoading")}
        </p>
      )}
    </div>
  );
}

function SessionError() {
  const t = useTranslations("auth");
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-5">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p className="text-sm leading-relaxed text-muted">{t("sessionError")}</p>
        <button
          type="button"
          onClick={retrySession}
          className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-transform active:scale-[0.97]"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
