import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerGate } from "./SellerDashboard";

export async function generateMetadata({ params }: PageProps<"/[locale]/seller">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seller" });
  // Private dashboard: never in search results.
  return { title: `${t("title")} - PeelPlan`, robots: { index: false, follow: false } };
}

export default async function SellerPage({ params }: PageProps<"/[locale]/seller">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <SellerGate />
      </main>
    </>
  );
}
