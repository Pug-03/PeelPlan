"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMarketQuery } from "@/features/market/store";
import { LoadError } from "@/features/market/ui/buyer";
import { Link } from "@/i18n/navigation";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Approved sellers' shops, loaded on the client like ShopLoader (in test mode they only exist on
 * this device). Renders nothing until there is at least one, so the examples below stand alone.
 */
export function RealShops() {
  const t = useTranslations("shop");
  const { data, error, retry } = useMarketQuery(async (s) => (await s.listShops()).filter((x) => !x.example && x.status === "approved"), []);

  if (!data && error)
    return (
      <section aria-labelledby="real-shops" className="flex flex-col gap-4">
        <h2 id="real-shops" className="text-xl font-semibold tracking-tight">
          {t("realTitle")}
        </h2>
        <LoadError onRetry={retry} />
      </section>
    );
  if (!data?.length) return null;

  return (
    <section aria-labelledby="real-shops" className="flex flex-col gap-4">
      <h2 id="real-shops" className="text-xl font-semibold tracking-tight">
        {t("realTitle")}
      </h2>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((shop) => (
          <li key={shop.id} className="group/lift">
            <Link
              href={`/shops/${shop.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-bg shadow-soft transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover/lift:-translate-y-0.5"
            >
              <div className="h-28 bg-surface" style={{ background: `linear-gradient(135deg, ${shop.tint}, var(--surface))` }}>
                {shop.cover && (
                  // eslint-disable-next-line @next/next/no-img-element -- seller uploads / data URLs in test mode
                  <img src={shop.cover} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="flex items-center gap-3 px-4 pt-3 pb-4">
                <span
                  className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-bold text-[#111]"
                  style={{ background: shop.tint }}
                  aria-hidden="true"
                >
                  {shop.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller uploads / data URLs in test mode
                    <img src={shop.logo} alt="" className="size-full object-cover" />
                  ) : (
                    initialsOf(shop.name) || "?"
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium group-hover:underline">{shop.name}</span>
                  {shop.city && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <MapPin className="size-3" strokeWidth={2} aria-hidden="true" />
                      <span className="truncate">{shop.city}</span>
                    </span>
                  )}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
