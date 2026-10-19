import { useLocale } from "next-intl";
import { LidArt } from "@/components/LidArt";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { EXAMPLE_LAYOUTS } from "./layouts";
import { shopSlug } from "@/config/demoShops";
import { Link } from "@/i18n/navigation";
import { DragMarquee } from "./DragMarquee";

function Card({ layout, hidden }: { layout: (typeof EXAMPLE_LAYOUTS)[number]; hidden?: boolean }) {
  const locale = useLocale() as "th" | "en";
  const model = getLaptopModel(layout.modelId);
  const g = lidGeometry(model);
  return (
    <figure aria-hidden={hidden} className="group relative w-[19rem] shrink-0 sm:w-[22rem]">
      <div className="drop-shadow-[0_18px_22px_rgb(0_0_0/0.14)] transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:-translate-y-1">
        <LidArt
          logo={g.logo}
          logoFinish={model.logoFinish}
          widthMm={g.widthMm}
          heightMm={g.heightMm}
          radiusMm={g.cornerRadiusMm}
          color={layout.color}
          stickers={layout.stickers}
          className="h-auto w-full"
        />
      </div>
      <figcaption className="flex items-center gap-3 px-1.5 pt-3 pb-1">
        <span className="min-w-0 flex-1">
          {/* Stretched link: the whole card opens the shop, but a drag on the strip still scrolls it. */}
          <Link
            href={`/shops/${shopSlug(layout.shop.name)}`}
            tabIndex={hidden ? -1 : undefined}
            draggable={false}
            className="block truncate text-sm font-medium after:absolute after:inset-0 after:rounded-[var(--radius-card)] hover:underline"
          >
            {layout.shop.name}
          </Link>
          <span className="block text-xs text-muted">{layout.shop.city[locale]}</span>
        </span>
        <span className="text-xs tabular-nums text-muted">{model.name.replace(/^MacBook /, "")}</span>
      </figcaption>
    </figure>
  );
}

export function Marquee({ label, pauseLabel, playLabel }: { label: string; pauseLabel: string; playLabel: string }) {
  return (
    // The carousel inside carries the label; labelling this wrapper too would announce it twice.
    <section className="relative pb-12">
      <DragMarquee label={label} pauseLabel={pauseLabel} playLabel={playLabel}>
        {[...EXAMPLE_LAYOUTS, ...EXAMPLE_LAYOUTS].map((l, i) => (
          <Card key={i} layout={l} hidden={i >= EXAMPLE_LAYOUTS.length} />
        ))}
      </DragMarquee>
    </section>
  );
}
