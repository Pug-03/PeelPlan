import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_SHOPS, getDemoShop, type DemoShop } from "@/config/demoShops";
import { PRODUCT_TYPES } from "@/config/onboarding";
import { ShopLoader } from "./ShopLoader";
import { ShopView } from "./ShopView";

export function generateStaticParams() {
  return DEMO_SHOPS.map((s) => ({ slug: s.slug }));
}

/** `/shops/preview?name=…` shows a brand-new seller their own (empty, pending) page. */
function previewShop(sp: Record<string, string | string[] | undefined>, fallbackName: string): DemoShop {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 1000) : "");
  const name = str("name").slice(0, 80) || fallbackName;
  const types = str("types")
    .split(",")
    .filter((t) => (PRODUCT_TYPES as readonly string[]).includes(t));
  return {
    slug: "preview",
    name,
    initials: name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    tint: "#E5E5EA",
    city: { en: "Thailand", th: "ประเทศไทย" },
    joined: new Date().toISOString().slice(0, 7),
    verified: false,
    stats: { sold: 0, rating: 0, reviews: 0, followers: 0, responseHours: 1 },
    about: { en: str("about"), th: str("about") },
    productTypes: types.length ? types : ["die-cut"],
    products: [],
    reviews: [],
  };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/shops/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  // A seller's preview is private and pending review: keep it out of search results.
  if (slug === "preview") return { robots: { index: false } };
  const shop = getDemoShop(slug);
  // Sellers' own shops load on the client (test mode keeps them on this device): not indexable from here.
  return shop ? { title: `${shop.name} - PeelPlan`, alternates: { canonical: `/${locale}/shops/${slug}` } } : { robots: { index: false } };
}

export default async function ShopPage({ params, searchParams }: PageProps<"/[locale]/shops/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const preview = slug === "preview";
  const t = await getTranslations("shop");
  // Only the preview reads the query, so the example shops stay statically rendered.
  const shop = preview ? previewShop(await searchParams, t("yourShop")) : getDemoShop(slug);
  return (
    <>
      <SiteHeader />
      <main id="main">{shop ? <ShopView demo={shop} preview={preview} /> : <ShopLoader slug={slug} />}</main>
    </>
  );
}
