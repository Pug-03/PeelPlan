import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { FeedbackFooter } from "@/features/feedback/FeedbackFooter";
import { DEMO_SHOPS, getDemoShop } from "@/config/demoShops";
import { ShopLoader } from "./ShopLoader";
import { ShopView } from "./ShopView";

export function generateStaticParams() {
  return DEMO_SHOPS.map((s) => ({ slug: s.slug }));
}

/**
 * A Thai shop name makes a Thai slug, which arrives percent-encoded. Decode it once here: both
 * backends store (and compare) the readable slug. A malformed escape can't be decoded, so keep it.
 */
function decodeSlug(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/shops/[slug]">): Promise<Metadata> {
  const { locale, slug: raw } = await params;
  const slug = decodeSlug(raw);
  const shop = getDemoShop(slug);
  const enc = encodeURIComponent(slug);
  // Sellers' own shops load on the client (test mode keeps them on this device): not indexable from here.
  return shop
    ? {
        title: `${shop.name} - PeelPlan`,
        alternates: {
          canonical: `/${locale}/shops/${enc}`,
          languages: { th: `/th/shops/${enc}`, en: `/en/shops/${enc}`, "x-default": `/shops/${enc}` },
        },
      }
    : { robots: { index: false } };
}

export default async function ShopPage({ params }: PageProps<"/[locale]/shops/[slug]">) {
  const { locale, slug: raw } = await params;
  setRequestLocale(locale);
  const slug = decodeSlug(raw);
  const shop = getDemoShop(slug);
  return (
    <>
      <SiteHeader />
      <main id="main">{shop ? <ShopView demo={shop} /> : <ShopLoader slug={slug} />}</main>
      <FeedbackFooter />
    </>
  );
}
