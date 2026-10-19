"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-3.9 7-9.8 7-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Real Google OAuth (disabled until Supabase keys are configured). */
export function GoogleButton({ next, disabled = false }: { next?: string; disabled?: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={async () => {
        const supabase = createSupabaseBrowser();
        if (!supabase) return;
        setBusy(true);
        const params = new URLSearchParams({ locale, ...(next ? { next } : {}) });
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback?${params}` },
        });
        if (error) setBusy(false);
      }}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-hairline bg-bg text-base font-medium transition-colors hover:bg-surface disabled:opacity-60"
    >
      <GoogleMark />
      {t("google")}
    </button>
  );
}
