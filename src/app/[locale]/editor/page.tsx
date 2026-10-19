import { setRequestLocale } from "next-intl/server";
import { EditorClient } from "./EditorClient";

export default async function EditorPage({ params }: PageProps<"/[locale]/editor">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EditorClient />;
}
