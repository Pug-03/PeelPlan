import Link from "next/link";
import { NotFoundView, notFoundPrimary, notFoundSecondary } from "@/components/NotFoundView";
import "./globals.css";

/**
 * Fallback 404 for paths the locale proxy never sees (files, /api, /auth). Next wraps it in its built-in
 * <html><body>, so it renders content only. The language is unknown here, so it shows both.
 */
export default function NotFound() {
  return (
    <main>
      <NotFoundView
        title={
          <>
            This page peeled off
            <span className="mt-2 block text-[0.6em] text-muted">ไม่พบหน้านี้</span>
          </>
        }
        body="The link may be old or mistyped."
        actions={
          <>
            <Link href="/en" className={notFoundPrimary}>
              Back home
            </Link>
            <Link href="/th" lang="th" className={notFoundSecondary}>
              กลับหน้าแรก (ไทย)
            </Link>
          </>
        }
      />
    </main>
  );
}
