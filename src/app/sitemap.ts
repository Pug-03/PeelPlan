import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/app/[locale]/legal/[doc]/page";
import { DEMO_SHOPS } from "@/config/demoShops";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/editor", "/shops", ...DEMO_SHOPS.map((s) => `/shops/${s.slug}`), ...LEGAL_DOCS.map((d) => `/legal/${d}`)];
  return paths.flatMap((path) => {
    const languages = {
      ...Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
      // The unprefixed URL picks a language from the browser, so it's the right x-default.
      "x-default": `${SITE_URL}${path || "/"}`,
    };
    return routing.locales.map((locale) => ({ url: `${SITE_URL}/${locale}${path}`, alternates: { languages } }));
  });
}
