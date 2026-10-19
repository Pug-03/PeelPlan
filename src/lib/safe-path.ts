/**
 * Returns a same-origin path (pathname + search + hash) or the fallback.
 * Rejects absolute URLs, protocol-relative `//`, backslash tricks (`/\evil.com`), control characters,
 * and paths that only become `//host` after dot-segment normalisation (`/..//evil.com`).
 */
export function safePath(next: string | null | undefined, fallback: string): string {
  if (!next || /[\u0000-\u001f\\]/.test(next)) return fallback;
  const origin = "https://peelplan.invalid";
  try {
    const u = new URL(next, origin);
    if (u.origin !== origin || !next.startsWith("/") || u.pathname.includes("//")) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Drops a leading locale segment so next-intl can re-prefix the path. */
export function stripLocale(path: string) {
  const rest = path.replace(/^\/(th|en)(?=[/?#]|$)/, "");
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/** Pages that only make sense before sign-in finishes; returning to them would loop. */
const AUTH_PAGES = /^\/(login|onboarding|auth)(?=[/?#]|$)/;

/**
 * Where to go once signed in and onboarded: the sanitised `next`, else the collection.
 * Locale-less, for next-intl's router/redirect.
 */
export function afterAuthPath(next: string | null | undefined): string {
  const dest = stripLocale(safePath(next, "/collection"));
  return AUTH_PAGES.test(dest) || dest === "/" ? "/collection" : dest;
}
