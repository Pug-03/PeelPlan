"use client";

import { Moon, Sun, Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
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
      className="relative grid size-9 place-items-center rounded-full text-muted transition-colors after:absolute after:-inset-1 hover:bg-surface hover:text-ink sm:size-10 sm:after:hidden"
    >
      <Sun className="hidden size-[18px] dark:block" strokeWidth={1.75} />
      <Moon className="size-[18px] dark:hidden" strokeWidth={1.75} />
    </button>
  );
}

const noSubscribe = () => () => {};

// Cart / messages counts read this device's storage and the session: client-only, so the server HTML never disagrees.
const HeaderMarket = dynamic(() => import("./HeaderMarket"), { ssr: false });

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

  // Two invisible markers from the top of the page down to FOLD_AT and UNFOLD_AT; watching them leave and
  // return replaces reading scrollY on every frame (each read forced a style recalc while scroll scenes ran).
  const foldMark = useRef<HTMLDivElement>(null);
  const unfoldMark = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      const pastFold = seen.get(foldMark.current!) === false;
      const pastUnfold = seen.get(unfoldMark.current!) === false;
      setFolded((f) => (f ? pastUnfold : pastFold));
    });
    io.observe(foldMark.current!);
    io.observe(unfoldMark.current!);
    return () => io.disconnect();
  }, []);

  // The menu card opens from the folded button, or from the menu button on phones; Escape and outside clicks close it.
  const menuOpen = open;
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
      <div className="relative h-[76px]" aria-hidden="true">
        <div ref={foldMark} className="pointer-events-none absolute top-0 left-0 w-px" style={{ height: FOLD_AT }} />
        <div ref={unfoldMark} className="pointer-events-none absolute top-0 left-0 w-px" style={{ height: UNFOLD_AT }} />
      </div>
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
              <HeaderMarket />
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface md:hidden"
                aria-label={t("menu")}
                aria-expanded={menuOpen}
                onClick={() => setOpen((o) => !o)}
              >
                <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
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
            <div className="my-1 flex flex-col gap-0.5 border-t border-hairline pt-2">
              <HeaderMarket variant="menu" onNavigate={() => setOpen(false)} />
            </div>
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
