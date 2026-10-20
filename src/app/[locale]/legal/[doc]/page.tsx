import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { Link } from "@/i18n/navigation";

/** Legal documents (PDPA). Text lives in messages under `legal.<doc>`. */
export const LEGAL_DOCS = ["privacy", "cookies", "terms", "rights", "sellers"] as const;
type Doc = (typeof LEGAL_DOCS)[number];

type Props = { params: Promise<{ locale: string; doc: string }> };
type Section = { h: string; p: string[] };

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }));
}

const isDoc = (d: string): d is Doc => (LEGAL_DOCS as readonly string[]).includes(d);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `${t(`${doc}.title`)} - PeelPlan`, alternates: { canonical: `/${locale}/legal/${doc}` } };
}

export default async function LegalPage({ params }: Props) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const sections = t.raw(`${doc}.sections`) as Section[];

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto grid max-w-6xl gap-12 px-5 pt-8 pb-24 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={t("navLabel")} className="flex flex-wrap gap-2 lg:sticky lg:top-24 lg:flex-col lg:self-start">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d}
              href={`/legal/${d}`}
              aria-current={d === doc ? "page" : undefined}
              className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {t(`${d}.title`)}
            </Link>
          ))}
        </nav>
        <article className="max-w-[70ch]">
          <p className="text-sm text-muted">{t("updated")}</p>
          <h1 className="mt-2 text-[clamp(2rem,4.5vw,3rem)] leading-tight font-semibold tracking-tight text-balance">{t(`${doc}.title`)}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{t(`${doc}.intro`)}</p>
          <p className="mt-6 rounded-2xl border border-dashed border-hairline px-4 py-3 text-sm text-muted">{t("draftNote")}</p>
          <div className="mt-10 flex flex-col gap-9">
            {sections.map((s, i) => (
              <section key={i} className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  <span className="mr-2 tabular-nums text-muted">{i + 1}.</span>
                  {s.h}
                </h2>
                {s.p.map((para, k) => (
                  <p key={k} className="leading-relaxed text-muted">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </main>
    </>
  );
}
