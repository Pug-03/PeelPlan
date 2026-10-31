import type { Metadata } from "next";
import { ArrowRight, Printer, Ruler, Laptop } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LidArt } from "@/components/LidArt";
import { SiteHeader } from "@/components/SiteHeader";
import { Wordmark } from "@/components/Wordmark";
import { HeroPlayground } from "@/components/landing/HeroPlayground";
import { Intro } from "@/components/landing/Intro";
import { Marquee } from "@/components/landing/Marquee";
import { BuyFlow, ForSellers, Gallery, Pricing, Reviews, SizeTable, UseCases } from "@/components/landing/MoreSections";
import { EXAMPLE_LAYOUTS } from "@/components/landing/layouts";
import "@/components/landing/landing-extras.css";
import { RevealOnScroll } from "@/components/landing/Reveal";
import { ScrollFx } from "@/components/landing/ScrollFx";
import { ScrollStory } from "@/components/landing/ScrollStory";
import { StickerStorm } from "@/components/landing/StickerStorm";
import { PeelScene } from "@/components/landing/PeelScene";
import { BreakFrame } from "@/components/landing/BreakFrame";
import { KineticBand } from "@/components/landing/KineticBand";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { LAPTOP_MODELS, getLaptopModel, lidGeometry } from "@/config/laptops";
import { visibleLayout } from "@/components/landing/scatter";
import { FeedbackLink } from "@/features/feedback/FeedbackLink";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return {
    // The unprefixed URL redirects to the visitor's language, so it is the x-default (same as sitemap.ts).
    alternates: { canonical: `/${locale}`, languages: { th: "/th", en: "/en", "x-default": "/" } },
  };
}

export default async function Landing({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tm = await getTranslations("more");
  const tl = await getTranslations("legal");
  const faq = t.raw("faq") as { q: string; a: string }[];
  const pro14 = lidGeometry(getLaptopModel("macbook-pro-14-m5"));
  // Hero shows the Studio Kluay example (Pro 14", silver, coding stickers).
  const heroLayout = EXAMPLE_LAYOUTS.find((l) => l.shop.name === "Studio Kluay") ?? EXAMPLE_LAYOUTS[0];

  const steps = [
    { icon: Laptop, title: t("step1Title"), body: t("step1Body") },
    { icon: Ruler, title: t("step2Title"), body: t("step2Body") },
    { icon: Printer, title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <>
      <Intro tagline={t("introTagline")} />
      <SmoothScroll />
      <RevealOnScroll />
      <ScrollFx />
      <SiteHeader />
      <main id="main" className="has-intro">
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-6 px-5 pt-2 pb-4 sm:px-8 sm:pt-2 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-4">
          {/* min-w-0: a grid column sizes to its widest child by default, which pushed the hero past
              the section's padding and scrolled the whole landing page sideways on small phones. */}
          <div className="min-w-0">
            <h1 className="hero-title max-w-[14ch] text-balance text-[clamp(2.6rem,min(6vw,9.5dvh),5.2rem)] leading-[0.98] font-semibold tracking-[-0.04em]">
              <span className="hero-line">{t("heroA")}</span> <span className="hero-line editorial-italic text-[1.08em]">{t("heroB")}</span>{" "}
              <span className="hero-line">{t("heroC")}</span>{" "}
              <span className="hero-line peel-word relative">
                {t("heroPeel")}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 200 14"
                  preserveAspectRatio="none"
                  className="hero-underline absolute -bottom-1 left-0 h-[0.16em] w-full text-accent dark:text-accent-bright"
                >
                  <path d="M2 9c40-6 80-8 120-4s56 2 76-2" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength={1} />
                </svg>
              </span>
            </h1>
            <p className="hero-fade mt-6 max-w-[46ch] text-lg leading-relaxed text-muted sm:text-xl">{t("heroSub")}</p>
            <div className="hero-fade mt-6 flex flex-wrap items-center gap-x-5 gap-y-3" style={{ "--d": "520ms" } as React.CSSProperties}>
              <Link
                href="/editor"
                className="cta-run cta-pop group relative inline-flex items-center gap-2.5 rounded-full bg-[#D7FF3A] px-9 py-[1.125rem] text-lg font-extrabold text-[#111] sm:text-xl"
              >
                {t("heroCta")}
                <ArrowRight className="cta-run-arrow size-5" strokeWidth={2.25} />
              </Link>
              <span className="text-sm text-muted">{t("heroNote")}</span>
            </div>
          </div>
          <div className="hero-fade group relative mx-auto w-full max-w-lg min-w-0 lg:max-w-none" style={{ "--d": "300ms" } as React.CSSProperties}>
            <HeroPlayground initial={visibleLayout(heroLayout.stickers, lidGeometry(getLaptopModel(heroLayout.modelId)))} initialModelId={heroLayout.modelId} initialColor={heroLayout.color} />
          </div>
        </section>

        <Marquee label={t("marqueeLabel")} pauseLabel={t("marqueePause")} playLabel={t("marqueePlay")} />

        {/* Scroll story */}
        <ScrollStory
          title={
            <>
              {t("storyTitleA")} <span className="editorial-italic">{t("storyTitleB")}</span> {t("storyTitleC")}
            </>
          }
          steps={[t("story1"), t("story2"), t("story3"), t("story4")]}
          svgLabel={t("storySvgLabel")}
        />

        <KineticBand words={tm.raw("bandA") as string[]} wordsB={tm.raw("bandB") as string[]} />

        {/* How it works */}
        <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32">
          <p className="reveal text-sm font-medium tracking-wide text-muted uppercase">{t("howEyebrow")}</p>
          <h2 className="reveal mt-3 max-w-[18ch] text-balance text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
            {t("howTitleA")} <span className="editorial-italic text-muted">{t("howTitleB")}</span>
          </h2>
          <ol data-fx="steps" className="relative mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
            {/* Accent line that runs across the steps as you scroll. */}
            <span data-fx-line aria-hidden="true" className="absolute top-0 left-0 hidden h-0.5 w-full origin-left bg-accent md:block" />
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={i} data-fx-item className="border-t border-ink pt-6">
                <div className="flex items-center justify-between">
                  <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-sm tabular-nums text-muted">
                    {i + 1} / {steps.length}
                  </span>
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 max-w-[36ch] leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>

          {/* The numbers behind "zero guesswork" */}
          <dl className="mt-16 grid border-t border-hairline md:grid-cols-3">
            {[
              [t("statAccuracy"), t("statAccuracyLabel")],
              [t("statScale"), t("statScaleLabel")],
              [String(LAPTOP_MODELS.length), t("statModelsLabel")],
            ].map(([v, l], i) => (
              <div
                key={i}
                className="reveal flex flex-col gap-2 border-b border-hairline py-8 last:border-b-0 md:border-b-0 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <dt className="order-2 max-w-[28ch] text-muted">{l}</dt>
                <dd className="stat-figure order-1 text-[clamp(3rem,6vw,4.75rem)] leading-none tabular-nums">
                  {i === 2 ? (
                    <span data-fx="countup" data-to={v}>
                      {v}
                    </span>
                  ) : v.startsWith("±") ? (
                    // The serif's ± is tiny and sits low; draw a taller one in the same thin, slanted stroke.
                    <>
                      <svg
                        viewBox="0 0 10 13"
                        aria-hidden="true"
                        className="pm-glyph mr-[0.08em] inline-block h-[0.66em] w-auto align-baseline"
                        style={{ transform: "skewX(-12deg)" }}
                      >
                        <path d="M5 0.6V8.2M1.2 4.4H8.8M1.2 12.2H8.8" stroke="currentColor" strokeWidth="0.95" strokeLinecap="round" fill="none" />
                      </svg>
                      <span className="sr-only">±</span>
                      {v.slice(1)}
                    </>
                  ) : (
                    v
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <StickerStorm
          lineA={tm("storm.lineA")}
          lineB={tm("storm.lineB")}
          mark={tm("storm.mark")}
          caption={tm("storm.caption", { count: 10 })}
          side={tm("storm.side")}
        />
        <UseCases />
        <Gallery />
        <SizeTable />
        <PeelScene title={tm("peel.title")} titleB={tm("peel.titleB")} body={tm("peel.body")} peelLabel={tm("peel.peelLabel")} />

        {/* Shops preview */}
        <section data-fx="sheet" className="bg-surface">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 md:grid-cols-2 md:py-28">
            <div className="reveal">
              <h2 className="text-balance text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{t("shopsTitle")}</h2>
              <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-muted">{t("shopsBody")}</p>
              <Link
                href="/shops"
                className="cta-run cta-run-ink group mt-7 inline-flex items-center gap-2 rounded-full border border-hairline bg-bg px-5 py-2.5 font-medium transition-colors hover:border-ink"
              >
                {t("shopsLink")}
                <ArrowRight className="cta-run-arrow size-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
            <div className="reveal relative mx-auto w-full max-w-md">
              <div className="group lid-float rotate-[-2deg] drop-shadow-[0_28px_32px_rgb(0_0_0/0.16)]">
                <LidArt
                  logo={pro14.logo}
                  logoFinish="gloss-black"
                  widthMm={pro14.widthMm}
                  heightMm={pro14.heightMm}
                  radiusMm={pro14.cornerRadiusMm}
                  color="#D9DADC"
                  stickers={[
                    { id: "tiny-planet", x: 85, y: 70, r: -6 },
                    { id: "peel-star", x: 230, y: 60, r: 10 },
                    { id: "wave", x: 205, y: 165, r: -3 },
                    { id: "smile-blob", x: 75, y: 165, r: 8 },
                  ]}
                  className="h-auto w-full rounded-xl"
                  lazy
                />
              </div>
              <div className="absolute -bottom-6 -left-2 rounded-2xl border border-hairline bg-bg px-4 py-3 shadow-soft sm:-left-8">
                <p className="text-sm font-medium">{t("tryOn")}</p>
                <p className="text-xs tabular-nums text-muted">55 × 55 mm · 1:1</p>
              </div>
            </div>
          </div>
        </section>

        <ForSellers />
        <Reviews />
        <Pricing />
        <BuyFlow />

        <KineticBand words={tm.raw("bandB") as string[]} wordsB={tm.raw("bandA") as string[]} />

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32">
          <h2 className="reveal text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{t("faqTitle")}</h2>
          <div className="mt-12 divide-y divide-hairline border-y border-hairline">
            {faq.map((f, i) => (
              <details key={i} name="faq" className="faq-item group [&_summary::-webkit-details-marker]:hidden">
                {/* The whole row, padding included, is the click target. */}
                <summary className="flex cursor-pointer list-none items-baseline gap-5 rounded-md py-6 transition-colors hover:text-muted">
                  <span className="w-8 shrink-0 text-sm tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-xl font-medium tracking-tight">{f.q}</span>
                  <span aria-hidden="true" className="relative size-4 shrink-0 self-center">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-ink" />
                    <span className="absolute inset-y-0 left-1/2 w-px bg-ink transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-6 pl-13 leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing scene: a sticker breaks out of the lid, then the call to action. */}
        <BreakFrame
          lineA={tm("break.lineA")}
          lineB={tm("break.lineB")}
          mark={tm("break.mark")}
          cta={t("ctaButton")}
          sub={tm("break.sub")}
          slapHint={tm("break.slapHint")}
        />
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pt-6 pb-12 text-sm text-muted sm:px-8">
        <FeedbackLink className="border-b border-hairline pt-10 pb-10" />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <Wordmark className="text-ink" />
          <div className="max-w-[60ch] space-y-1 md:text-right">
            <p>{t("footerLegal")}</p>
            <p>{t("placeholderNote")}</p>
          </div>
        </div>
        {/* PDPA documents */}
        <div className="flex flex-col gap-3 border-t border-hairline pt-6 md:flex-row md:items-center md:justify-between">
          <nav aria-label={tl("navLabel")} className="flex flex-wrap gap-x-5 gap-y-2">
            {(["privacy", "cookies", "terms", "rights", "sellers"] as const).map((d) => (
              <Link key={d} href={`/legal/${d}`} className="underline-offset-4 transition-colors hover:text-ink hover:underline">
                {tl(`footer.${d}`)}
              </Link>
            ))}
          </nav>
          <p className="text-xs">{tl("footer.pdpa")} · © 2026 PeelPlan</p>
        </div>
      </footer>
    </>
  );
}
