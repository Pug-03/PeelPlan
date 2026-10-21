"use client";

import { Moon, Sun, Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { RulerMark, Wordmark } from "./Wordmark";
import "./site-header.css";

const isDarkNow = () => {
  const root = document.documentElement;
  return root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

export function ThemeToggle() {
  const t = useTranslations("nav");
  // The theme lives on <html> (set before paint), so it can only be read after mount: null until then,
  // which leaves aria-pressed off the server HTML instead of guessing and breaking hydration.
  const [isDark, setIsDark] = useState<boolean | null>(null);
  useEffect(() => {
    const read = () => setIsDark(isDarkNow());
    read();
    // ThemeSync and other tabs can change it too.
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const system = matchMedia("(prefers-color-scheme: dark)");
    system.addEventListener("change", read);
    return () => {
      mo.disconnect();
      system.removeEventListener("change", read);
    };
  }, []);
  const toggle = () => {
    const next = isDarkNow() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
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
      aria-pressed={isDark ?? undefined}
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

/**
 * Set just before a language switch so the remounted header can pick up where it was (menu open, folded).
 * Only read on the client-side navigation that follows, never during hydration.
 */
const KEEP_KEY = "peelplan.langswap";
// Read-only so a double-invoked initializer (StrictMode in dev) gets the same answer; SiteHeader clears it after mount.
function readLangSwap(): { menu: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEEP_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { menu: boolean; at: number };
    return Date.now() - v.at < 5000 ? v : null;
  } catch {
    return null;
  }
}

/** On-screen elements that hold text of their own (outermost only): the pieces a language switch morphs. */
function textBlocks(): HTMLElement[] {
  const out: HTMLElement[] = [];
  // Words under the header or an open menu card would be lifted above it, so they stay in the page.
  // (Hit testing can't tell: during a view transition every point hits <html>.)
  const header = document.querySelector(".site-header");
  const covers = [...document.querySelectorAll(".site-header-shell, .site-header-menu")].map((n) => n.getBoundingClientRect());
  const covered = (el: HTMLElement, r: DOMRect) =>
    !header?.contains(el) && covers.some((c) => r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top);
  // Text clipped by an overflow-hidden/clip ancestor (marquees, the review strip) would be lifted out of its clip and
  // drawn whole during the transition, so only blocks that sit fully inside every clipping ancestor are taken.
  type Clip = { left: number; top: number; right: number; bottom: number } | null;
  const inside = (r: DOMRect, c: Clip) => !c || (r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5);
  const clipOf = (el: HTMLElement, r: DOMRect, c: Clip): Clip => {
    // Any non-visible overflow clips that axis (hidden, clip, and scroll containers alike).
    const { overflowX, overflowY } = getComputedStyle(el);
    const x = overflowX !== "visible";
    const y = overflowY !== "visible";
    if (!x && !y) return c;
    const base = c ?? { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
    return {
      left: x ? Math.max(base.left, r.left) : base.left,
      right: x ? Math.min(base.right, r.right) : base.right,
      top: y ? Math.max(base.top, r.top) : base.top,
      bottom: y ? Math.min(base.bottom, r.bottom) : base.bottom,
    };
  };
  const walk = (el: Element, clip: Clip) => {
    for (const child of el.children) {
      if (!(child instanceof HTMLElement) || out.length >= 120) continue;
      const r = child.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      const ownText = [...child.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
      // A caption sitting in the same box as a picture (the lid's "312.6 mm") must not take the picture with it.
      if (ownText && r.height < 240 && !child.querySelector("img, picture, canvas, video, svg:not(:only-child)")) {
        if (!covered(child, r) && inside(r, clip)) out.push(child);
      } else walk(child, clipOf(child, r, clip));
    }
  };
  walk(document.body, null);
  return out;
}

/**
 * Give each text block its own view-transition name so only the words change: the old ones blur away,
 * the new ones rise in top to bottom, and everything else (laptop, stickers, photos) holds still.
 * Old and new words never pair, so nothing slides across the page. Blocks with a fill (pills, chips)
 * do pair, by order when they sit in about the same spot, so they stretch to the new label instead of vanishing.
 * Words that read the same in both languages ("PeelPlan", "312.6 mm") in the same spot keep their old name and hold still.
 */
type TextBlock = { el: HTMLElement; rect: DOMRect; filled: boolean; text: string; name: string };
function unnameTextBlocks(blocks: TextBlock[]) {
  blocks.forEach(({ el }) => {
    el.style.removeProperty("view-transition-name");
    el.style.removeProperty("view-transition-class");
  });
}
function nameTextBlocks(prev: TextBlock[] | null, sheet: HTMLStyleElement): TextBlock[] {
  if (prev) unnameTextBlocks(prev);
  const rules: string[] = [];
  const claimed = new Set<TextBlock>();
  const blocks = textBlocks().map((el, i) => {
    const rect = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    const filled = css.backgroundColor !== "rgba(0, 0, 0, 0)" || css.backgroundImage !== "none";
    const text = el.textContent ?? "";
    const was = prev?.[i];
    const paired = filled && (!prev || (was?.filled && Math.abs(was.rect.top - rect.top) < 64 && Math.abs(was.rect.left - rect.left) < 64));
    // View-transition names must be unique, so each old block can be matched once.
    const same = prev?.find((b) => !claimed.has(b) && !b.filled && b.text === text && Math.abs(b.rect.top - rect.top) < 4 && Math.abs(b.rect.left - rect.left) < 4);
    if (same) claimed.add(same);
    const name = same ? same.name : paired ? `lang-box-${i}` : `lang-${prev ? "new" : "old"}-${i}`;
    el.style.setProperty("view-transition-name", name);
    el.style.setProperty("view-transition-class", same ? "lang-same" : filled ? "lang-box" : "lang-text");
    // Paired pills stay on screen and stretch, so they don't wait for their turn like the words do.
    if (prev && !same && !paired) rules.push(`::view-transition-new(${name}){animation-delay:${160 + Math.round(Math.min(1, Math.max(0, rect.top / innerHeight)) * 160)}ms}`);
    return { el, rect, filled, text, name };
  });
  if (prev) sheet.textContent = rules.join("");
  return blocks;
}

/** The language switch in flight, so a second click can't start another one and undo its cleanup. */
let activeSwap: ViewTransition | null = null;

export function LocaleSwitch({ className = "", inMenu = false }: { className?: string; inMenu?: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const next = locale === "th" ? "en" : "th";
  const pathname = usePathname();
  const router = useRouter();
  // Keep the query (e.g. a seller's /shops/preview?name=…) and the hash (an admin's #reports tab)
  // when switching; empty on the server.
  const suffix = useSyncExternalStore(
    noSubscribe,
    () => window.location.search + window.location.hash,
    () => "",
  );
  const href = `${pathname}${suffix}`;

  // Fetch the other language's page ahead of time (on hover / focus), so the switch itself only swaps it in.
  const prefetch = () => router.prefetch(href, { locale: next });

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (activeSwap) return;
    try {
      sessionStorage.setItem(KEEP_KEY, JSON.stringify({ menu: inMenu, at: Date.now() }));
    } catch {
      /* storage unavailable: the menu just closes */
    }
    // Stay where you are on the page; only the language changes.
    const go = () => router.push(href, { locale: next, scroll: false });
    const root = document.documentElement;
    const swap = "startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The page remounts in the new language: don't replay the hero's entrance, it reads as lag.
    // data-lang-swap turns on the text morph in globals.css.
    const flag = () => {
      root.dataset.noEntrance = "";
      if (swap) root.dataset.langSwap = next;
    };
    flag();
    // Hand the entrance suppression to the page that landed: <main> is a fresh element on every
    // navigation, so coming back to the landing page later plays the entrance again.
    const settle = () => {
      document.querySelector("main")?.setAttribute("data-no-entrance", "");
      delete root.dataset.noEntrance;
    };
    // This switch, until its cleanup has run. A page that lands after that must not re-arm the flags:
    // data-lang-swap left on <html> would kill every scroll reveal for the rest of the session.
    let live = true;
    let stopWatching = () => {};
    // The new page is in once <html lang> flips. React wipes <html>'s attributes when the [locale] layout
    // remounts, so put the flags back right away, before the browser paints or snapshots the new page.
    // No requestAnimationFrame here: rendering is paused during a view transition, so it would only fire after the timeout.
    const arrived = new Promise<void>((resolve) => {
      const obs = new MutationObserver(() => {
        if (root.lang !== next) return;
        stopWatching();
        if (live) flag();
        settle();
        // The new header has read the menu state by now; pages without one (the editor) never clear it.
        try {
          sessionStorage.removeItem(KEEP_KEY);
        } catch {
          /* storage unavailable */
        }
        resolve();
      });
      obs.observe(root, { attributes: true, attributeFilter: ["lang"] });
      // On a slow network stop holding the screen. Watching carries on until the switch's cleanup, so
      // the flags still land if the page arrives a moment later — and never after that.
      const timer = setTimeout(resolve, 1200);
      stopWatching = () => {
        obs.disconnect();
        clearTimeout(timer);
      };
    });
    if (!swap) {
      void arrived.finally(() => {
        live = false;
        stopWatching();
        settle();
      });
      return go();
    }
    const sheet = document.createElement("style");
    document.head.append(sheet);
    let blocks = nameTextBlocks(null, sheet);
    const vt = (activeSwap = document.startViewTransition(async () => {
      go();
      await arrived;
      blocks = nameTextBlocks(blocks, sheet);
    }));
    void vt.finished.finally(() => {
      live = false;
      stopWatching();
      activeSwap = null;
      delete root.dataset.langSwap;
      settle();
      unnameTextBlocks(blocks);
      sheet.remove();
      try {
        sessionStorage.removeItem(KEEP_KEY);
      } catch {
        /* storage unavailable */
      }
    });
  };

  return (
    <Link
      href={href}
      locale={next}
      scroll={false}
      onClick={onClick}
      onPointerEnter={prefetch}
      onFocus={prefetch}
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
  // Server-safe to start with: sessionStorage and scrollY are only readable after mount, and a switch
  // that never finished would otherwise leave the client hydrating an open menu the server never sent.
  const [folded, setFolded] = useState(false);
  const [open, setOpen] = useState(false);
  // A menu carried over from the other language is already open: don't pop it in again.
  const [resumed, setResumed] = useState(false);
  const toggleMenu = () => {
    setResumed(false);
    setOpen((o) => !o);
  };
  // After a language switch the header remounts: come back folded / with the menu open, as it was.
  useEffect(() => {
    const resume = readLangSwap();
    try {
      sessionStorage.removeItem(KEEP_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!resume) return;
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage and scrollY can only be read
       after mount, and reading them in the initialisers is what made the client hydrate a state the
       server HTML never had. One pass on mount, never again. */
    if (window.scrollY > FOLD_AT) setFolded(true);
    if (resume.menu) {
      setOpen(true);
      setResumed(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const panel = useRef<HTMLDivElement>(null);
  // Escape and outside clicks hand focus back to whichever control opened the menu.
  const menuBtn = useRef<HTMLButtonElement>(null);
  const orbBtn = useRef<HTMLButtonElement>(null);

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
    // Closing without choosing anything: put focus back on the trigger, not on <body>.
    const dismiss = () => {
      setOpen(false);
      (folded ? orbBtn : menuBtn).current?.focus({ preventScroll: true });
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    const click = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && dismiss();
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", click);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", click);
    };
  }, [menuOpen, folded]);

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
                ref={menuBtn}
                type="button"
                className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface md:hidden"
                aria-label={t("menu")}
                aria-expanded={menuOpen}
                onClick={toggleMenu}
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
            ref={orbBtn}
            type="button"
            className="site-header-orb"
            aria-label={t("menu")}
            aria-expanded={menuOpen}
            aria-hidden={!folded}
            tabIndex={folded ? 0 : -1}
            onClick={toggleMenu}
          >
            <RulerMark className="size-7" />
          </button>
        </header>

        {menuOpen && (
          <nav className="site-header-menu" data-resumed={resumed || undefined} aria-label={t("menu")}>
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
              <LocaleSwitch inMenu />
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
