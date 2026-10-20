"use client";

/**
 * Cart and messages shortcuts for the site header. Loaded client-only (see SiteHeader): the counts
 * come from this device's storage and the signed-in session, and the store is kept out of every page's first load.
 */
import { MessageCircle, Receipt, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart, useMarket } from "@/features/market/store";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/session";

function useUnread(userId: string | null) {
  return (
    useMarket(
      async (s) => {
        if (!userId) return 0;
        const [mine, shop] = await Promise.all([s.buyerThreads(userId), s.myShop(userId)]);
        const forShop = shop ? await s.shopThreads(shop.id) : [];
        return mine.reduce((n, t) => n + t.unreadBuyer, 0) + forShop.reduce((n, t) => n + t.unreadShop, 0);
      },
      [userId],
    ) ?? 0
  );
}

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
export default function HeaderMarket({ variant = "bar", onNavigate }: { variant?: "bar" | "menu"; onNavigate?: () => void }) {
  const t = useTranslations("market.header");
  const lines = useCart();
  const session = useSession();
  const userId = session.status === "signed-in" ? session.session.user.id : null;
  const unread = useUnread(userId);
  const items = lines.reduce((n, l) => n + l.qty, 0);

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
