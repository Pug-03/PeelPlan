import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase/config";

const intl = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = intl(request);
  if (!AUTH_ENABLED) return response;
  // Refresh the Supabase session cookie on the same response next-intl produced.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        // Mirror onto the request so Server Components in this pass see the fresh token,
        // and forward Supabase's no-store headers so a CDN never caches Set-Cookie.
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  // getClaims refreshes an expired session like getUser, but checks the JWT locally (cached JWKS) when the
  // project signs with asymmetric keys, instead of a round trip to Supabase Auth on every page and language switch.
  // It rethrows anything that isn't an AuthError, and an unhandled throw here would 500 every page,
  // the public landing included; carrying on with the cookie as it stands is far cheaper.
  try {
    await supabase.auth.getClaims();
  } catch {
    /* leave the session as it is; the page decides what to do with it */
  }
  return response;
}

export const config = {
  matcher: "/((?!api/|auth/|_next|_vercel|.*\\..*).*)",
};
