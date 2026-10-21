import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitch } from "@/components/SiteHeader";
import { Wordmark } from "@/components/Wordmark";
import { redirect } from "@/i18n/navigation";
import { afterAuthPath, safePath } from "@/lib/safe-path";
import { AUTH_ENABLED } from "@/lib/supabase/config";
import { getSession } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { robots: { index: false } };

export default async function OnboardingPage({ params, searchParams }: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("auth");
  const session = await getSession();
  // Without Supabase the form runs as a click-through preview; with it, sign-in is required.
  const preview = !AUTH_ENABLED && sp.preview === "1";
  const next = safePath(typeof sp.next === "string" ? sp.next : null, "");
  if (!session && !preview) return redirect({ href: next ? `/login?next=${encodeURIComponent(next)}` : "/login", locale });
  if (session?.profile?.onboarded_at) return redirect({ href: afterAuthPath(next), locale });

  return (
    <main className="min-h-dvh bg-surface px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        {/* There is no site header here, so the language switch rides along with the wordmark. */}
        <div className="flex items-center justify-between gap-3">
          <Wordmark />
          <LocaleSwitch className="-mr-2" />
        </div>
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">{t("onboardTitle")}</h1>
        <p className="mt-2 text-muted">{t("onboardBody")}</p>
        {preview && <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm">{t("previewBanner")}</p>}
        <OnboardingForm defaultName={session?.profile?.display_name ?? ""} next={next} preview={preview} />
      </div>
    </main>
  );
}
