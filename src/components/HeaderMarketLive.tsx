"use client";

/**
 * The counting half of the header, split out so the market store and the auth client only reach the
 * browser once there is a session or a cart to read (see HeaderMarket).
 */
import { useCart, useMarket } from "@/features/market/store";
import { useSession } from "@/lib/session";
import { MarketIcons, type MarketProps } from "./HeaderMarket";

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

export default function HeaderMarketLive({ variant, onNavigate }: MarketProps) {
  const lines = useCart();
  const session = useSession();
  const userId = session.status === "signed-in" ? session.session.user.id : null;
  const unread = useUnread(userId);
  return <MarketIcons variant={variant} onNavigate={onNavigate} items={lines.reduce((n, l) => n + l.qty, 0)} unread={unread} userId={userId} />;
}
