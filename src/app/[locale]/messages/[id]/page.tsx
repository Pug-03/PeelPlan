import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { MessagesApp } from "@/features/chat/MessagesApp";

export async function generateMetadata({ params }: PageProps<"/[locale]/messages/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function ConversationPage({ params }: PageProps<"/[locale]/messages/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <MessagesApp threadId={id} />
      </main>
    </>
  );
}
