import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Wordmark } from "@/components/Wordmark";
import { Link, redirect } from "@/i18n/navigation";
import { afterAuthPath, safePath } from "@/lib/safe-path";
import { AUTH_ENABLED } from "@/lib/supabase/config";
import { getSession } from "@/lib/supabase/server";
import { DemoSignIn } from "./DemoSignIn";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { robots: { index: false } };

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("auth");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  // Already signed in: carry on to `next` (or finish the profile first).
  const session = await getSession();
  if (session)
    redirect({
      href: session.profile?.onboarded_at ? afterAuthPath(next) : `/onboarding?next=${encodeURIComponent(safePath(next, ""))}`,
      locale,
    });

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-5 py-12">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-hairline bg-bg p-8 shadow-soft">
        <Link href="/" aria-label="PeelPlan" className="inline-block rounded-lg">
          <Wordmark />
        </Link>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{t("loginTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("loginBody")}</p>
        {sp.error && (
          <p role="alert" className="mt-5 rounded-xl bg-accent-soft p-3 text-sm">
            {t("loginError")}
          </p>
        )}
        <div className="mt-6">
          <div className="flex flex-col gap-3">
            <GoogleButton next={next} disabled={!AUTH_ENABLED} />
            {!AUTH_ENABLED && <p className="rounded-xl bg-surface p-3 text-xs leading-relaxed text-muted">{t("notConfigured")}</p>}
          </div>
          {!AUTH_ENABLED && <DemoSignIn next={next} />}
        </div>
        <Link href="/" className="mt-6 block text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
