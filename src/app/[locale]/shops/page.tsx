import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LidArt } from "@/components/LidArt";
import { SiteHeader } from "@/components/SiteHeader";
import { FeedbackFooter } from "@/features/feedback/FeedbackFooter";
import { EXAMPLE_LAYOUTS } from "@/components/landing/layouts";
import { DEMO_SHOPS, shopSlug } from "@/config/demoShops";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { Link } from "@/i18n/navigation";

// Spelled out: PageProps<"/[locale]/shops"> only exists once Next regenerates its route types.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  return { title: `${t("indexTitle")} - PeelPlan`, alternates: { canonical: `/${locale}/shops` } };
}

/** Index of the example shops; each card shows the shop's own layout on its lid. */
export default async function ShopsIndex({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shop");
  const lang = locale === "en" ? "en" : "th";

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex max-w-7xl flex-col gap-10 px-5 pt-6 pb-20 sm:px-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{t("indexTitle")}</h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted">{t("indexBody")}</p>
        </header>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_SHOPS.map((shop) => {
            const layout = EXAMPLE_LAYOUTS.find((l) => shopSlug(l.shop.name) === shop.slug);
            const model = getLaptopModel(layout?.modelId ?? "");
            const g = lidGeometry(model);
            return (
              <li key={shop.slug}>
                <Link
                  href={`/shops/${shop.slug}`}
                  className="group flex h-full flex-col rounded-[var(--radius-card)] border border-hairline bg-bg p-3 shadow-soft transition-transform duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5"
                >
                  <div className="rounded-[0.9rem] bg-surface p-4">
                    <LidArt
                      logo={g.logo}
                      logoFinish={model.logoFinish}
                      widthMm={g.widthMm}
                      heightMm={g.heightMm}
                      radiusMm={g.cornerRadiusMm}
                      color={layout?.color ?? model.colors[0].hex}
                      stickers={layout?.stickers ?? []}
                      className="h-auto w-full"
                    />
                  </div>
                  <div className="flex items-center gap-3 px-1.5 pt-3 pb-1">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-[#111]"
                      style={{ background: shop.tint }}
                      aria-hidden="true"
                    >
                      {shop.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium group-hover:underline">{shop.name}</span>
                      <span className="block text-xs text-muted">
                        {shop.city[lang]} · {t("productsCount", { count: shop.products.length })}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                      <Star className="size-3.5 fill-current" strokeWidth={1.5} aria-hidden="true" />
                      <span className="sr-only">{t("rating")}</span>
                      {shop.stats.rating.toFixed(1)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted">{t("demoNote")}</p>
      </main>
      <FeedbackFooter />
    </>
  );
}
