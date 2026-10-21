"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * A session is a cookie. With cookies blocked, Google sign-in can finish and still leave the visitor
 * signed out — every protected page just bounces back here — so say so instead of looping in silence.
 */
export function CookieNotice() {
  const t = useTranslations("auth");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // navigator.cookieEnabled is optimistic in some privacy modes, so try a real write as well.
    const ok = () => {
      if (navigator.cookieEnabled === false) return false;
      try {
        document.cookie = "peelplan_probe=1; path=/; max-age=60; SameSite=Lax";
        const wrote = document.cookie.includes("peelplan_probe=");
        document.cookie = "peelplan_probe=; path=/; max-age=0; SameSite=Lax";
        return wrote;
      } catch {
        return false;
      }
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document.cookie only exists after mount
    setBlocked(!ok());
  }, []);

  if (!blocked) return null;
  return (
    <p role="alert" className="mt-5 rounded-xl bg-accent-soft p-3 text-sm leading-relaxed">
      {t("cookiesBlocked")}
    </p>
  );
}
