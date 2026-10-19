import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export async function createSupabaseServer() {
  if (!AUTH_ENABLED) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  birth_date: string | null;
  is_shop: boolean;
  onboarded_at: string | null;
};

/** Current user + profile, or null when signed out or accounts are disabled. */
export async function getSession() {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, birth_date, is_shop, onboarded_at")
    .eq("id", user.id)
    .single<Profile>();
  return { user, profile };
}
