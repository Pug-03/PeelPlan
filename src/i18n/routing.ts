import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["th", "en"],
  // Everyone lands in English; Thai is one tap away in the header. No Accept-Language or cookie guessing.
  defaultLocale: "en",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
