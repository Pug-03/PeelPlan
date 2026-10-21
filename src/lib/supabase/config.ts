export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Accounts are optional in Phase 1: without credentials the app runs fully local (browser test mode).
 * next.config.ts warns when a production build or server starts that way.
 */
export const AUTH_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
