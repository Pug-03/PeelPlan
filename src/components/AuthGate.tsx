"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useSession, type Session } from "@/lib/session";
import { useEffect, type ReactNode } from "react";

/**
 * Everyone signs in with Google before using the app. Signed-out visitors go to /login and come
 * back here afterwards; signed-in people who haven't finished the profile form go to onboarding.
 */
export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const state = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "loading") return;
    // Keep the hash too: a share link (#s=…) must survive the trip through sign-in.
    const back = encodeURIComponent(pathname + window.location.search + window.location.hash);
    if (state.status === "signed-out") router.replace(`/login?next=${back}`);
    else if (!state.session.profile) router.replace(`/onboarding?${state.session.demo ? "preview=1&" : ""}next=${back}`);
  }, [state, router, pathname]);

  if (state.status !== "signed-in" || !state.session.profile) return <div className="min-h-dvh bg-surface" aria-busy="true" />;
  return <>{children(state.session)}</>;
}
