import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lets a verification build use its own folder (NEXT_DIST_DIR=.next-build) without clobbering a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Hide the Next.js "N" badge in development; errors still show in the overlay.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
