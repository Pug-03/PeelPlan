"use client";

import { Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMarketQuery } from "@/features/market/store";
import { LoadError } from "@/features/market/ui/buyer";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/session";
import { ShopView, profileFromShop } from "./ShopView";

/** A seller's own shop: loaded from the store on the client (in test mode it only exists on this device). */
export function ShopLoader({ slug }: { slug: string }) {
  const t = useTranslations("market.shopPage");
  const session = useSession();
  const { data: shop, error, retry } = useMarketQuery((s) => s.getShop(slug), [slug]);
  const userId = session.status === "signed-in" ? session.session.user.id : null;
  const title = shop?.name;
  // The server can't name a shop that only exists on this device; set the tab title once it loads.
  useEffect(() => {
    if (title) document.title = `${title} - PeelPlan`;
  }, [title]);

  if (shop === undefined && error) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 pt-6 pb-20 sm:px-8">
        <LoadError onRetry={retry} />
      </div>
    );
  }

  if (shop === undefined || session.status === "loading") {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 pt-6 pb-20 sm:px-8" aria-busy="true">
        <div className="h-44 animate-pulse rounded-[1.75rem] bg-surface sm:h-56" />
        <div className="h-8 w-56 animate-pulse rounded-full bg-surface" />
      </div>
    );
  }

  // Shops waiting for review are visible to their owner only.
  const isOwner = !!shop && shop.ownerId === userId;
  if (!shop || (shop.status !== "approved" && !isOwner)) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-5 pt-16 pb-24 text-center">
        <Store className="size-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("notFoundTitle")}</h1>
        <p className="text-muted">{t("notFoundBody")}</p>
        <Link href="/shops" className="mt-3 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-bg">
          {t("browseShops")}
        </Link>
      </div>
    );
  }

  return <ShopView profile={profileFromShop(shop)} market={shop} pending={shop.status !== "approved"} />;
}
