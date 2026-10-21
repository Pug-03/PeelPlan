import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const env = process.env;
// Local verification builds (NEXT_DIST_DIR=.next-build, or ALLOW_LOCAL_SITE_URL=1) may run without deploy settings.
const localBuild = Boolean(env.NEXT_DIST_DIR || env.ALLOW_LOCAL_SITE_URL === "1");

/** Same resolution as src/lib/site.ts: a production build must not bake http://localhost:3000 into sitemaps and OG tags. */
function checkSiteUrl() {
  if (env.NEXT_PUBLIC_SITE_URL || env.VERCEL_PROJECT_PRODUCTION_URL || localBuild) return;
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is not set. Set it to the public origin (e.g. https://peelplan.app) for production builds, " +
      "or set ALLOW_LOCAL_SITE_URL=1 for a local build that may use http://localhost:3000.",
  );
}

/** Without Supabase keys the app runs in browser test mode (simulated sign-in, data on the device). Fine locally, wrong on a deploy. */
function warnAuthOff() {
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
  console.warn(
    "\n[PeelPlan] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set: accounts are OFF and the app runs in " +
      "browser test mode (simulated Google sign-in, data saved only on each device). Set both for a real deployment.\n",
  );
}

/**
 * Content-Security-Policy. Scripts allow 'unsafe-inline' because Next streams inline RSC scripts and ThemeScript
 * sets the theme before paint; a nonce setup would force every page to render dynamically. 'unsafe-eval' is dev-only
 * (React's dev tooling and HMR). Fonts come from next/font, which self-hosts them, so no Google Fonts origin is needed.
 */
function contentSecurityPolicy(dev: boolean) {
  const supabase = env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  const realtime = supabase.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' data: blob: ${supabase} ${realtime}${dev ? " ws:" : ""}`.trim(),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) checkSiteUrl();
  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) warnAuthOff();
  const dev = phase === PHASE_DEVELOPMENT_SERVER;

  return withNextIntl({
    // Lets a verification build use its own folder (NEXT_DIST_DIR=.next-build) without clobbering a running dev server.
    distDir: env.NEXT_DIST_DIR || ".next",
    // Hide the Next.js "N" badge in development; errors still show in the overlay.
    devIndicators: false,
    // Demo stickers live outside public/ and are read from disk by /stickers/demo/[file]; ship them only when enabled.
    ...(env.NEXT_PUBLIC_DEMO_ASSETS === "true" ? { outputFileTracingIncludes: { "/stickers/demo/[file]": ["./demo-assets/stickers/**"] } } : {}),
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            // No feature uses the camera (uploads are plain file pickers), microphone or location.
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ],
        },
      ];
    },
  });
}
