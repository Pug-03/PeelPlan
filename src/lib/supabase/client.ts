"use client";

import { createBrowserClient } from "@supabase/ssr";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export const createSupabaseBrowser = () => (AUTH_ENABLED ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null);
