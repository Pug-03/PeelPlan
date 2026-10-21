"use client";

/**
 * Cart and messages shortcuts for the site header. Loaded client-only (see SiteHeader): the counts
 * come from this device's storage and the signed-in session, and the store is kept out of every page's first load.
 *
 * The counts need the market store, and with accounts on the auth client as well — together about a
 * fifth of the landing page's JavaScript, plus a realtime socket. A visitor with no session and
 * nothing in the cart has nothing to count, so the links stand on their own until that changes.
 */
import { MessageCircle, Receipt, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

export type MarketProps = { variant?: "bar" | "menu"; onNavigate?: () => void };
type CountedProps = MarketProps & { items: number; unread: number; userId: string | null };

const cap = (n: number) => (n > 99 ? "99+" : String(n));

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#D7FF3A] px-1 text-[10px] leading-none font-bold text-[#111] tabular-nums ring-2 ring-bg"
    >
      {cap(n)}
    </span>
  );
}

// The after: box widens the tap area to 44 px on phones without changing the look.
const iconBtn =
  "relative grid size-9 place-items-center rounded-full text-muted transition-colors after:absolute after:-inset-1 hover:bg-surface hover:text-ink sm:size-10 sm:after:hidden";

/** Icons in the full bar. Messages show from `sm` up; on phones they live in the ☰ menu. */
export function MarketIcons({ variant = "bar", onNavigate, items, unread, userId }: CountedProps) {
  const t = useTranslations("market.header");

  if (variant === "menu") {
    const row = "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-surface";
    const count = (n: number) =>
      n > 0 && <span className="rounded-full bg-[#D7FF3A] px-2 py-0.5 text-xs font-semibold text-[#111] tabular-nums">{cap(n)}</span>;
    return (
      <>
        <Link href="/cart" className={row} onClick={onNavigate}>
          <span className="inline-flex items-center gap-2">
            <ShoppingCart className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t("cart")}
          </span>
          {count(items)}
        </Link>
        {userId && (
          <>
            <Link href="/orders" className={row} onClick={onNavigate}>
              <span className="inline-flex items-center gap-2">
                <Receipt className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t("orders")}
              </span>
            </Link>
            <Link href="/messages" className={row} onClick={onNavigate}>
              <span className="inline-flex items-center gap-2">
                <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t("messages")}
              </span>
              {count(unread)}
            </Link>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {userId && (
        <Link href="/messages" className={`${iconBtn} hidden sm:grid`} aria-label={unread ? t("messagesUnread", { count: unread }) : t("messages")}>
          <MessageCircle className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          <Badge n={unread} />
        </Link>
      )}
      <Link href="/cart" className={iconBtn} aria-label={items ? t("cartCount", { count: items }) : t("cart")}>
        <ShoppingCart className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        <Badge n={items} />
      </Link>
    </>
  );
}

/** Cheap signs that something could be counted: a Supabase session cookie, the simulated test account, or a saved cart. */
function worthCounting() {
  try {
    if (document.cookie.includes("sb-")) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === "peelplan.session.v1" || k?.startsWith("peelplan.cart")) return true;
    }
  } catch {
    // Storage blocked: don't guess, just load the real thing.
    return true;
  }
  return false;
}

// Private to src/features/market/store.ts and src/lib/session.ts; a sign-in or a first "add to cart"
// on this page fires one of them, which is the moment the counts start to matter.
const WAKE = ["peelplan:cart", "peelplan:session"];

export default function HeaderMarket(props: MarketProps) {
  const [Live, setLive] = useState<React.ComponentType<MarketProps> | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void import("./HeaderMarketLive").then((m) => alive && setLive(() => m.default));
    if (worthCounting()) {
      load();
      return () => {
        alive = false;
      };
    }
    WAKE.forEach((e) => window.addEventListener(e, load));
    return () => {
      alive = false;
      WAKE.forEach((e) => window.removeEventListener(e, load));
    };
  }, []);

  return Live ? <Live {...props} /> : <MarketIcons {...props} items={0} unread={0} userId={null} />;
}
