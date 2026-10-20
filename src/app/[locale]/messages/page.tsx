import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { MessagesApp } from "@/features/chat/MessagesApp";

export async function generateMetadata({ params }: PageProps<"/[locale]/messages">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function MessagesPage({ params }: PageProps<"/[locale]/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <MessagesApp />
      </main>
    </>
  );
}
