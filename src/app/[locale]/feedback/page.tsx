import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { FeedbackSection } from "@/features/feedback/FeedbackSection";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ from?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "feedback" });
  return { title: `${t("pageTitle")} - PeelPlan`, robots: { index: false } };
}

/** Same-site path only; anything else falls back to the home page. */
const safeFrom = (v: string | string[] | undefined) => (typeof v === "string" && /^\/(?!\/)/.test(v) ? v.slice(0, 200) : "/");

export default async function FeedbackPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const from = safeFrom((await searchParams).from);
  const t = await getTranslations("feedback");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex max-w-5xl flex-col gap-8 px-5 pt-6 pb-20 sm:px-8">
        <Link href={from} className="-my-2 inline-flex items-center gap-1.5 self-start rounded-full py-1 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {t("back")}
        </Link>
        <FeedbackSection fromPath={from} className="text-base" />
      </main>
    </>
  );
}
