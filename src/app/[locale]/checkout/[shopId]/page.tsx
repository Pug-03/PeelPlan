import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutGate } from "./CheckoutView";

type Props = { params: Promise<{ locale: string; shopId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "market.checkout" });
  return { title: `${t("title")} - PeelPlan`, robots: { index: false } };
}

export default async function CheckoutPage({ params }: Props) {
  const { locale, shopId } = await params;
  setRequestLocale(locale);
  let id = shopId;
  try {
    // Example shop ids contain ":"; depending on the client it may arrive still encoded.
    id = decodeURIComponent(shopId);
  } catch {
    /* keep as is */
  }
  return (
    <>
      <SiteHeader />
      <main id="main">
        <CheckoutGate shopId={id} />
      </main>
    </>
  );
}
