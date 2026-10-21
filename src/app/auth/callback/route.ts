import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { afterAuthPath } from "@/lib/safe-path";
import { createSupabaseServer } from "@/lib/supabase/server";

/** OAuth return URL: exchanges the code for a session, then sends new users to onboarding. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const localeParam = url.searchParams.get("locale");
  const locale = routing.locales.includes(localeParam as never) ? localeParam! : routing.defaultLocale;
  const next = url.searchParams.get("next");
  // `next` is captured from wherever sign-in started and may carry the other language, or none at all:
  // the locale the visitor signed in with wins, so an English sign-in never lands in Thai.
  const safeNext = `/${locale}${afterAuthPath(next)}`;

  const supabase = await createSupabaseServer();
  if (!supabase || !code) return NextResponse.redirect(new URL(`/${locale}/login?error=1`, url.origin));

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL(`/${locale}/login?error=1`, url.origin));

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).single();
  const dest = profile?.onboarded_at ? safeNext : `/${locale}/onboarding?next=${encodeURIComponent(safeNext)}`;
  return NextResponse.redirect(new URL(dest, url.origin));
}
