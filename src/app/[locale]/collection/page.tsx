import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { CollectionGate } from "./CollectionGate";

export const metadata: Metadata = { robots: { index: false } };

export default async function CollectionPage({ params }: PageProps<"/[locale]/collection">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <CollectionGate />
      </main>
    </>
  );
}
