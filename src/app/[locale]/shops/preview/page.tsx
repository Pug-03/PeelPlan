import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { FeedbackFooter } from "@/features/feedback/FeedbackFooter";
import type { DemoShop } from "@/config/demoShops";
import { PRODUCT_TYPES } from "@/config/onboarding";
import { ShopPreview } from "../ShopPreview";

// Spelled out: PageProps<"/[locale]/shops/preview"> only exists once Next regenerates its route types.
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Its own route (not /shops/[slug]): [slug] is prerendered for the example shops, and a prerendered
// page may not read the query string.
export const dynamic = "force-dynamic";

/**
 * `/shops/preview?name=…` shows a brand-new seller their own (empty, pending) page. Only the name and
 * the product types (checked against a fixed list) come from the URL, so a link can't put arbitrary
 * text on the site; the signed-in seller's own shop replaces it on the client (ShopPreview).
 */
function previewShop(sp: Record<string, string | string[] | undefined>, fallbackName: string): DemoShop {
  const str = (k: string, max: number) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, max) : "");
  const name = str("name", 80).trim() || fallbackName;
  const types = str("types", 200)
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
    about: { en: "", th: "" },
    productTypes: types.length ? types : ["die-cut"],
    products: [],
    reviews: [],
  };
}

// A seller's preview is private and pending review: keep it out of search results.
export const metadata: Metadata = { robots: { index: false } };

export default async function ShopPreviewPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shop");
  const shop = previewShop(await searchParams, t("yourShop"));
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ShopPreview fallback={shop} />
      </main>
      <FeedbackFooter />
    </>
  );
}
