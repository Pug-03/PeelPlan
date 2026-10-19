"use client";

import { Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { RulerMark, Wordmark } from "./Wordmark";
import "./site-header.css";

export function ThemeToggle() {
  const t = useTranslations("nav");
  const toggle = () => {
    const root = document.documentElement;
    const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("peelplan.theme", next);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("theme")}
      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink sm:size-10"
    >
      <Sun className="hidden size-[18px] dark:block" strokeWidth={1.75} />
      <Moon className="size-[18px] dark:hidden" strokeWidth={1.75} />
    </button>
  );
}

const noSubscribe = () => () => {};

export function LocaleSwitch({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  // Keep the query (e.g. a seller's /shops/preview?name=…) when switching; empty on the server.
  const search = useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => "",
  );
  return (
    <Link
      href={`${pathname}${search}`}
      locale={locale === "th" ? "en" : "th"}
      aria-label={t("languageLabel")}
      className={`rounded-full px-2 py-2 text-sm whitespace-nowrap text-muted transition-colors hover:bg-surface hover:text-ink sm:px-3 ${className}`}
    >
      {t("language")}
    </Link>
  );
}

/** Scroll distance (px) after which the bar folds into the floating button; a smaller value to unfold avoids flicker. */
const FOLD_AT = 140;
const UNFOLD_AT = 60;

/**
 * Site header. At the top of the page it is a full bar with fixed-width slots (from `sm` up; phones size
 * them to content so the bar fits), so switching Thai/English never shifts the layout. Once you scroll, it springs into a round button in the top-right corner;
 * tapping it opens the menu as a floating card.
 */
export function SiteHeader() {
  const t = useTranslations("nav");
  const [folded, setFolded] = useState(false);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setFolded((f) => (f ? y > UNFOLD_AT : y > FOLD_AT));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // The menu only exists while folded; Escape and outside clicks close it.
  const menuOpen = folded && open;
  useEffect(() => {
    if (!menuOpen) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const click = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", click);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", click);
    };
  }, [menuOpen]);

  const navLink = "grid h-10 place-items-center rounded-full px-2 text-sm text-muted transition-colors hover:text-ink";

  return (
    <>
      {/* Holds the bar's space in the page flow; the header itself is fixed. */}
      <div className="h-[76px]" aria-hidden="true" />
      <div ref={panel} data-folded={folded} className="site-header fixed z-50" style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
        <header className="site-header-shell">
          {/* Full bar */}
          <div className="site-header-bar" aria-hidden={folded} inert={folded}>
            <Link href="/" className="rounded-lg" aria-label="PeelPlan">
              <Wordmark />
            </Link>
            <nav aria-label={t("menu")} className="ml-auto hidden items-center md:flex">
              <Link href="/#how" className={`${navLink} w-[6.25rem]`}>
                {t("how")}
              </Link>
              <Link href="/shops" className={`${navLink} w-[4.75rem]`}>
                {t("shops")}
              </Link>
              <Link href="/#faq" className={`${navLink} w-[7rem]`}>
                {t("faq")}
              </Link>
            </nav>
            <div className="ml-auto flex items-center md:ml-0">
              <LocaleSwitch className="text-center sm:w-[5rem]" />
              <ThemeToggle />
              <Link
                href="/editor"
                className="hidden h-10 w-[9.5rem] place-items-center rounded-full text-sm font-medium text-ink transition-colors hover:bg-surface sm:grid"
              >
                {t("open")}
              </Link>
            </div>
          </div>

          {/* Folded: one round button */}
          <button
            type="button"
            className="site-header-orb"
            aria-label={t("menu")}
            aria-expanded={menuOpen}
            aria-hidden={!folded}
            tabIndex={folded ? 0 : -1}
            onClick={() => setOpen((o) => !o)}
          >
            <RulerMark className="size-7" />
          </button>
        </header>

        {menuOpen && (
          <nav className="site-header-menu" aria-label={t("menu")}>
            <Link href="/" className="mb-1 rounded-lg px-2 py-1" onClick={() => setOpen(false)}>
              <Wordmark />
            </Link>
            <Link href="/#how" className="rounded-xl px-3 py-2.5 text-sm hover:bg-surface" onClick={() => setOpen(false)}>
              {t("how")}
            </Link>
            <Link href="/shops" className="rounded-xl px-3 py-2.5 text-sm hover:bg-surface" onClick={() => setOpen(false)}>
              {t("shops")}
            </Link>
            <Link href="/#faq" className="rounded-xl px-3 py-2.5 text-sm hover:bg-surface" onClick={() => setOpen(false)}>
              {t("faq")}
            </Link>
            <div className="my-1 flex items-center justify-between border-t border-hairline pt-2">
              <LocaleSwitch />
              <ThemeToggle />
            </div>
            <Link href="/editor" className="grid h-11 place-items-center rounded-full bg-ink text-sm font-medium text-bg" onClick={() => setOpen(false)}>
              {t("open")}
            </Link>
          </nav>
        )}
      </div>
    </>
  );
}
