import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { CollectionGate } from "./CollectionGate";

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
