"use client";

import type { DemoShop } from "@/config/demoShops";
import { useMarket } from "@/features/market/store";
import { useSession } from "@/lib/session";
import { ShopView, profileFromShop } from "./ShopView";

/**
 * A seller's preview of their own page. Shows the signed-in seller's real shop record when there is
 * one; otherwise only the name from the link (`fallback`), always under the preview banner.
 */
export function ShopPreview({ fallback }: { fallback: DemoShop }) {
  const session = useSession();
  const userId = session.status === "signed-in" ? session.session.user.id : null;
  const mine = useMarket((s) => (userId ? s.myShop(userId) : Promise.resolve(null)), [userId]);
  return mine ? <ShopView profile={profileFromShop(mine)} preview /> : <ShopView demo={fallback} preview />;
}
