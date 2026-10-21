/**
 * Public origin for canonical URLs, sitemaps and Open Graph, read at build time. Set NEXT_PUBLIC_SITE_URL
 * in production; on Vercel the project's production domain is used if it's missing. next.config.ts fails a
 * production build that would otherwise fall through to localhost.
 */
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
