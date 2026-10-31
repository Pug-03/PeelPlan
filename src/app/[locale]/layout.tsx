import type { Metadata, Viewport } from "next";
import { Anuphan, Instrument_Serif, Inter_Tight } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FullscreenKey } from "@/components/FullscreenKey";
import { DomGuardScript, ThemeScript, ThemeSync } from "@/components/ThemeSync";
import { VisitTracker } from "@/features/analytics/VisitTracker";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import "../globals.css";

// Arial (the generated fallback) has no Thai glyphs; use real Thai system faces instead.
const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  variable: "--font-anuphan",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Leelawadee UI", "Thonburi", "Noto Sans Thai", "system-ui", "sans-serif"],
});
// Heavy display face for the big moving words; Thai falls back to Anuphan.
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["800"], variable: "--font-display", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-instrument", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    // No canonical/og:url here: every page inherits layout metadata, and they'd all point at the home page.
    openGraph: {
      type: "website",
      siteName: "PeelPlan",
      title: t("title"),
      description: t("description"),
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  return (
    <html lang={locale} className={`${anuphan.variable} ${instrument.variable} ${interTight.variable}`} suppressHydrationWarning>
      <head>
        <DomGuardScript />
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        {/* First tab stop: past the eight header controls, straight to <main id="main">. */}
        <a href="#main" className="skip-link">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <ThemeSync />
          <FullscreenKey />
          <VisitTracker />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
