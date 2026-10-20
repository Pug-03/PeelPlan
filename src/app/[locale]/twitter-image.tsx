import { routing } from "@/i18n/routing";
import { OG_ALT, OG_SIZE, shareImage } from "./_og/share-image";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

// Prerender one card per locale at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function TwitterImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return shareImage(locale);
}
