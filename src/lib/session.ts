"use client";

/**
 * Who is signed in, on the client.
 * - With Supabase keys: the real Google session (read lazily so pages without accounts stay light).
 * - Without keys (local testing): a simulated Google account stored on this device, so the whole
 *   sign-in → onboarding → collection flow can be tried before accounts are connected.
 */
import { useEffect, useState } from "react";
import { AUTH_ENABLED } from "@/lib/supabase/config";

export type SessionProfile = {
  displayName: string;
  birthDate: string;
  isShop: boolean;
  shop?: { name: string; ownerName: string; productTypes: string[]; description: string };
  onboardedAt: string;
};

export type SessionUser = { id: string; name: string; email: string; avatarUrl?: string };

export type Session = { user: SessionUser; profile: SessionProfile | null; demo: boolean };

const KEY = "peelplan.session.v1";
const EVENT = "peelplan:session";

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.user?.id ? { ...s, demo: true } : null;
  } catch {
    return null;
  }
}

function write(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Simulated "Continue with Google" for local testing. */
export function signInDemo() {
  const existing = read();
  if (existing) return existing;
  const s: Session = {
    user: { id: `demo-${Math.random().toString(36).slice(2, 10)}`, name: "PeelPlan Tester", email: "tester@peelplan.test" },
    profile: null,
    demo: true,
  };
  write(s);
  return s;
}

export function saveDemoProfile(profile: SessionProfile) {
  const s = read();
  if (s) write({ ...s, user: { ...s.user, name: profile.displayName || s.user.name }, profile });
}

export async function signOut() {
  if (AUTH_ENABLED) {
    const { createSupabaseBrowser } = await import("@/lib/supabase/client");
    await createSupabaseBrowser()?.auth.signOut();
  }
  write(null);
}

export type SessionState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; session: Session };

/** Current session; re-renders on sign-in/out in this or another tab. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    const fromDemo = () => {
      const s = read();
      if (alive) setState(s ? { status: "signed-in", session: s } : { status: "signed-out" });
    };
    if (!AUTH_ENABLED) {
      fromDemo();
      const on = () => fromDemo();
      window.addEventListener(EVENT, on);
      window.addEventListener("storage", on);
      return () => {
        alive = false;
        window.removeEventListener(EVENT, on);
        window.removeEventListener("storage", on);
      };
    }
    import("@/lib/supabase/client").then(async ({ createSupabaseBrowser }) => {
      const sb = createSupabaseBrowser();
      if (!sb || !alive) return;
      const apply = async (userId: string | undefined, meta: Record<string, unknown> | undefined, email: string | undefined) => {
        if (!userId) return alive && setState({ status: "signed-out" });
        const { data: p } = await sb.from("profiles").select("display_name, birth_date, is_shop, onboarded_at").eq("id", userId).maybeSingle();
        if (!alive) return;
        setState({
          status: "signed-in",
          session: {
            demo: false,
            user: { id: userId, name: (meta?.full_name as string) ?? email ?? "", email: email ?? "", avatarUrl: meta?.avatar_url as string | undefined },
            profile: p?.onboarded_at ? { displayName: p.display_name, birthDate: p.birth_date, isShop: p.is_shop, onboardedAt: p.onboarded_at } : null,
          },
        });
      };
      const { data } = await sb.auth.getSession();
      await apply(data.session?.user.id, data.session?.user.user_metadata, data.session?.user.email);
      const sub = sb.auth.onAuthStateChange((_e, session) => void apply(session?.user.id, session?.user.user_metadata, session?.user.email));
      unsub = () => sub.data.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return state;
}
