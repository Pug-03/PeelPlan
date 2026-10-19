import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/editor"].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`])) },
    })),
  );
}
