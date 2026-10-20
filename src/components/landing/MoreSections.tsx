import { ArrowRight, Check, Globe, GraduationCap, Home, Plus, Printer, Scissors, Star, Store } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LidArt, type ArtSticker } from "@/components/LidArt";
import { PACKED_DEV_LID } from "./packedLid";
import { LAPTOP_MODELS, getLaptopModel, lidGeometry } from "@/config/laptops";
import { Link } from "@/i18n/navigation";
import { stickerSrcById } from "@/stickers/library";

/**
 * Landing sections below "How it works". Anything that would need real customers (reviews,
 * gallery, print partners) is clearly marked as an example until real data replaces it.
 */

const heading = "text-balance text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em]";

/** Small "Example" chip used wherever content is illustrative. */
function ExampleChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-dashed border-hairline px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
  );
}

function Lid({ modelId, color, stickers }: { modelId: string; color: string; stickers: ArtSticker[] }) {
  const g = lidGeometry(getLaptopModel(modelId));
  const model = getLaptopModel(modelId);
  return (
    <LidArt
      logo={g.logo}
      logoFinish={model.logoFinish}
      widthMm={g.widthMm}
      heightMm={g.heightMm}
      radiusMm={g.cornerRadiusMm}
      color={color}
      stickers={stickers}
      className="h-auto w-full rounded-lg"
      lazy
    />
  );
}

/* ---------- Who it's for ---------- */

const USE_CASES: { key: "dev" | "student" | "collector" | "brand"; modelId: string; color: string; stickers: ArtSticker[] }[] = [
  {
    key: "dev",
    modelId: "macbook-pro-14-m5",
    color: "#2B2B2D",
    stickers: PACKED_DEV_LID,
  },
  {
    key: "student",
    modelId: "macbook-air-13-m5",
    color: "#C2CDD7",
    stickers: [
      { id: "peel-star", x: 70, y: 60, r: -8 },
      { id: "boba", x: 245, y: 70, r: 6 },
      { id: "tiny-planet", x: 85, y: 160, r: 4 },
      { id: "mushroom", x: 235, y: 160, r: -6 },
    ],
  },
  {
    key: "collector",
    modelId: "macbook-air-15-m5",
    color: "#D6CCBC",
    stickers: [
      { id: "kitty-02", x: 75, y: 60, w: 50, r: -6 },
      { id: "mickey-03", x: 265, y: 60, w: 50, r: 8 },
      { id: "elephant", x: 80, y: 175, r: 4 },
      { id: "smile-blob", x: 265, y: 175, r: -4 },
    ],
  },
  {
    key: "brand",
    modelId: "macbook-neo-13",
    color: "#E2CDC8",
    stickers: [
      { id: "see-actual-size", x: 80, y: 50, r: -4 },
      { id: "wave", x: 225, y: 60, r: 5 },
      { id: "code-stamp-ship-it", x: 85, y: 160, w: 60, r: 4 },
      { id: "lightning", x: 230, y: 155, r: -8 },
    ],
  },
];

export async function UseCases() {
  const t = await getTranslations("more");
  return (
    <section data-fx="hscroll" className="relative overflow-hidden">
      {/* Scrolling down moves this row to the left. */}
      <div data-fx-track className="flex h-[100dvh] w-max items-center gap-8 px-5 sm:px-8 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        <div className="flex w-[min(80vw,26rem)] shrink-0 flex-col gap-5">
          <h2 className={heading}>
            {t("useTitleA")} <span className="editorial-italic text-muted">{t("useTitleB")}</span>
          </h2>
          <p className="flex items-center gap-2 text-sm text-muted">
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
            {t("useHint")}
          </p>
        </div>
        <ul className="flex gap-6">
          {USE_CASES.map((u, i) => (
            <li key={u.key} className="group flex w-[min(78vw,30rem)] shrink-0 flex-col gap-5" style={{ marginTop: i % 2 ? "6rem" : 0 }}>
              <div data-tilt className="lid-float drop-shadow-[0_28px_32px_rgb(0_0_0/0.16)]" style={{ animationDelay: `${i * -1.3}s` }}>
                <Lid modelId={u.modelId} color={u.color} stickers={u.stickers} />
              </div>
              <div className="flex flex-col gap-2 px-1">
                <p className="text-sm tabular-nums text-muted">
                  {String(i + 1).padStart(2, "0")} / {String(USE_CASES.length).padStart(2, "0")}
                </p>
                <h3 className="text-2xl font-semibold tracking-tight">{t(`use.${u.key}.title`)}</h3>
                <p className="max-w-[40ch] leading-relaxed text-muted">{t(`use.${u.key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Gallery ---------- */

/**
 * Gallery lids: every lid gets its own four stickers (no sticker repeats across the gallery).
 * Each set is laid out in the lid's four quadrants with a little rotation.
 */
const GALLERY_SETS: { modelId: string; color: string; ids: [string, string, string, string] }[] = [
  { modelId: "macbook-air-13-m5", color: "#C2CDD7", ids: ["p2-som-tam", "p2-pad-thai", "p2-cha-yen", "p2-mango"] },
  { modelId: "macbook-pro-14-m5", color: "#D9DADC", ids: ["p2-cat", "p2-pup", "p2-frog", "p2-capybara"] },
  { modelId: "macbook-neo-13", color: "#E2CDC8", ids: ["p2-tuk-tuk", "p2-lotus", "p2-krathong", "p2-sky-lantern"] },
  { modelId: "macbook-air-15-m5", color: "#D6CCBC", ids: ["p2-rocket", "p2-ufo", "p2-saturn", "p2-alien"] },
  { modelId: "macbook-pro-16-m5", color: "#2B2B2D", ids: ["p2-cassette", "p2-game-controller", "p2-headphones", "p2-boombox"] },
  { modelId: "macbook-neo-13", color: "#DCDAB2", ids: ["p2-sun", "p2-rainbow", "p2-cactus", "p2-monstera"] },
  { modelId: "macbook-air-13-m5", color: "#CACBCE", ids: ["p2-su-su", "p2-555", "p2-heart", "p2-sparkle"] },
  { modelId: "macbook-pro-14-m5", color: "#D9DADC", ids: ["p2-axolotl", "p2-penguin", "p2-panda", "p2-bunny"] },
  { modelId: "macbook-air-15-m5", color: "#C2CDD7", ids: ["p2-durian", "p2-mangosteen", "p2-watermelon", "p2-coconut"] },
  { modelId: "macbook-neo-13", color: "#CACBCE", ids: ["p2-longtail-boat", "p2-elephant-head", "p2-temple-roof", "p2-water-gun"] },
  { modelId: "macbook-air-13-m5", color: "#D6CCBC", ids: ["p2-donut", "p2-pizza", "p2-burger", "p2-ice-cream"] },
  { modelId: "macbook-pro-16-m5", color: "#D9DADC", ids: ["p2-fox", "p2-whale", "p2-octopus", "p2-bee"] },
  { modelId: "macbook-pro-14-m5", color: "#2B2B2D", ids: ["p2-film-camera", "p2-polaroid", "p2-vinyl", "p2-floppy"] },
  { modelId: "macbook-neo-13", color: "#DCDAB2", ids: ["p2-chill", "p2-good-vibes", "p2-smiley", "p2-peace-hand"] },
  { modelId: "macbook-air-15-m5", color: "#CACBCE", ids: ["p2-daisy", "p2-tulip", "p2-sleepy-moon", "p2-seedling"] },
  { modelId: "macbook-air-13-m5", color: "#E2CDC8", ids: ["p2-boba-taro", "p2-roti", "p2-khanom-krok", "p2-dumpling"] },
];
const SLOT_TILT = [-8, 6, 5, -7];
const GALLERY: { modelId: string; color: string; stickers: ArtSticker[] }[] = GALLERY_SETS.map(({ modelId, color, ids }) => {
  const g = lidGeometry(getLaptopModel(modelId));
  return {
    modelId,
    color,
    stickers: ids.map((id, i) => ({ id, x: g.widthMm * (i % 2 ? 0.76 : 0.24), y: g.heightMm * (i < 2 ? 0.3 : 0.72), r: SLOT_TILT[i] })),
  };
});

export async function Gallery() {
  const t = await getTranslations("more");
  const locale = (await getLocale()) as "th" | "en";
  return (
    <section className="overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 pt-24 pb-12 sm:px-8 sm:pt-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className={`reveal max-w-[18ch] ${heading}`}>
            {t("galleryTitleA")} <span className="editorial-italic text-muted">{t("galleryTitleB")}</span>
          </h2>
          <ExampleChip label={t("example")} />
        </div>
        <p className="reveal mt-4 max-w-[52ch] text-lg leading-relaxed text-muted">{t("galleryBody")}</p>
      </div>
      {/* Two rows running in opposite directions; scrolling speeds them up. Each row is doubled for a seamless loop. */}
      <div className="flex flex-col gap-5 overflow-hidden pb-24 sm:pb-28">
        {[
          [0, 1, 2, 3, 4, 5, 6, 7],
          [8, 9, 10, 11, 12, 13, 14, 15],
        ]
          .map((half) => [...half, ...half])
          .map((row, r) => (
            <ul key={r} data-fx="loop" data-dir={r === 0 ? 1 : -1} className="flex w-max gap-5 pr-5">
              {row.map((i, k) => {
                const g = GALLERY[i];
                const model = getLaptopModel(g.modelId);
                const colorName = model.colors.find((c) => c.hex === g.color)?.name[locale];
                return (
                  <li key={k} aria-hidden={k >= row.length / 2 || undefined} className="flex w-[min(78vw,400px)] flex-col gap-3">
                    <div data-tilt className="drop-shadow-[0_22px_26px_rgb(0_0_0/0.16)]">
                      <Lid modelId={g.modelId} color={g.color} stickers={g.stickers} />
                    </div>
                    <p className="px-1 text-sm text-muted">
                      {model.name}
                      {colorName ? ` · ${colorName}` : ""} · {t("galleryCount", { count: g.stickers.length })}
                    </p>
                  </li>
                );
              })}
            </ul>
          ))}
      </div>
    </section>
  );
}

/* ---------- Real lid sizes ---------- */

/** One colour per model, shared by the outline drawing and the table swatches. */
const MODEL_TINT: Record<string, string> = {
  "macbook-neo-13": "#FF7A59",
  "macbook-air-13-m5": "#4C8DFF",
  "macbook-air-15-m5": "#2EC4B6",
  "macbook-pro-14-m5": "#8B7CF6",
  "macbook-pro-16-m5": "#E8A317",
};

/** Every lid outline drawn from the same corner at true relative size. */
function SizeOutlines() {
  const pad = 6;
  const maxW = Math.max(...LAPTOP_MODELS.map((m) => m.lid.widthMm.value));
  const maxH = Math.max(...LAPTOP_MODELS.map((m) => m.lid.heightMm.value));
  // Largest first so smaller lids sit on top.
  const models = [...LAPTOP_MODELS].sort((a, b) => b.lid.widthMm.value - a.lid.widthMm.value);
  // Light translucent tints build up where the lids overlap, and a slow colour wave runs through them.
  return (
    <svg data-fx="draw" viewBox={`0 0 ${maxW + pad * 2} ${maxH + pad * 2}`} className="mt-10 h-auto w-full max-w-md" aria-hidden="true">
      {models.map((m, i) => {
        const w = m.lid.widthMm.value;
        const h = m.lid.heightMm.value;
        return (
          <g key={m.id}>
            {/* Page-coloured backing so each smaller lid's tint sits on its own, not on the ones below. */}
            <rect x={pad} y={pad + maxH - h} width={w} height={h} rx={m.lid.cornerRadiusMm.value} className="fill-bg" />
            <rect
              data-fx-path
              data-o={m.id}
              className="size-outline"
              style={{ animationDelay: `${i * 0.5}s` }}
              x={pad}
              y={pad + maxH - h}
              width={w}
              height={h}
              rx={m.lid.cornerRadiusMm.value}
              fill={MODEL_TINT[m.id]}
              stroke={MODEL_TINT[m.id]}
              strokeWidth="1.8"
            />
          </g>
        );
      })}
    </svg>
  );
}

export async function SizeTable() {
  const t = await getTranslations("more");
  const mm = (v: number) => v.toFixed(1);
  return (
    <section id="sizes" className="sizes-fx mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <div className="reveal">
          <h2 className={heading}>
            {t("sizesTitleA")} <span className="editorial-italic text-muted">{t("sizesTitleB")}</span>
          </h2>
          <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-muted">{t("sizesBody")}</p>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#30a46c]" aria-hidden="true" />
              {t("sizesVerified")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full border border-muted" aria-hidden="true" />
              {t("sizesEstimate")}
            </span>
          </p>
          <SizeOutlines />
        </div>
        <div className="reveal overflow-x-auto">
          <table className="w-full border-collapse text-left tabular-nums sm:min-w-[560px]">
            <thead>
              <tr className="border-b border-ink text-sm text-muted">
                <th scope="col" className="py-3 pr-4 font-medium">
                  {t("sizesModel")}
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  {t("sizesWidth")}
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  {t("sizesDepth")}
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-medium sm:table-cell">
                  {t("sizesCorner")}
                </th>
                <th scope="col" className="hidden py-3 font-medium sm:table-cell">
                  {t("sizesLogo")}
                </th>
              </tr>
            </thead>
            <tbody>
              {LAPTOP_MODELS.map((m) => {
                const cell = (v: { value: number; verified: boolean }) => (
                  <span className="inline-flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${v.verified ? "bg-[#30a46c]" : "border border-muted"}`} aria-hidden="true" />
                    {mm(v.value)}
                    <span className="sr-only">{v.verified ? t("sizesVerified") : t("sizesEstimate")}</span>
                  </span>
                );
                return (
                  <tr key={m.id} data-m={m.id} className="border-b border-hairline transition-colors hover:bg-surface">
                    <th scope="row" className="py-4 pr-4 font-medium">
                      <span className="mr-2 inline-block h-0.5 w-4 rounded-full align-middle" style={{ background: MODEL_TINT[m.id] }} aria-hidden="true" />
                      {m.name}
                      <span className="block text-xs font-normal text-muted">{m.generation}</span>
                    </th>
                    <td className="py-4 pr-4">{cell(m.lid.widthMm)}</td>
                    <td className="py-4 pr-4">{cell(m.lid.heightMm)}</td>
                    <td className="hidden py-4 pr-4 sm:table-cell">{cell(m.lid.cornerRadiusMm)}</td>
                    <td className="hidden py-4 sm:table-cell">{cell(m.logo.heightMm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">{t("sizesUnit")}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------- For sticker shops ---------- */

export async function ForSellers() {
  const t = await getTranslations("more");
  const points = ["sell1", "sell2", "sell3"] as const;
  return (
    <section data-fx="sheet" className="bg-accent-soft">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 md:grid-cols-2 md:py-28">
        <div className="reveal">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">{t("sellEyebrow")}</p>
          <h2 className={`mt-3 ${heading}`}>
            {t("sellTitleA")} <span className="editorial-italic text-muted">{t("sellTitleB")}</span>
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3">
                <Check className="mt-1 size-5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                <span className="max-w-[46ch] leading-relaxed text-muted">{t(p)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/login?next=%2Fonboarding"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition-transform duration-300 hover:-translate-y-0.5"
          >
            {t("sellCta")}
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>
        <div className="reveal relative mx-auto w-full max-w-md">
          <div className="p-1 text-ink">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t("sellCardName")}</p>
              <ExampleChip label={t("example")} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["code-coder", "lang-python", "code-rubber-duck", "peel-star", "code-key-copy", "boba", "code-floppy"]
                .map((id) => stickerSrcById(id))
                .filter(Boolean)
                .slice(0, 6)
                .map((src, i) => (
                  <div
                    key={src}
                    data-fx="parallax"
                    data-speed={[14, -10, 20, -16, 8, -22][i]}
                    className="grid aspect-square place-items-center p-1 drop-shadow-[0_10px_14px_rgb(0_0_0/0.12)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full" />
                  </div>
                ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted">{t("sellCardMeta")}</span>
              <span className="rounded-full bg-accent px-3 py-1 font-medium text-accent-ink">{t("sellCardTry")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Reviews (examples) ---------- */

export async function Reviews() {
  const t = await getTranslations("more");
  const items = t.raw("reviews") as { quote: string; name: string; laptop: string }[];
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className={`reveal max-w-[18ch] ${heading}`}>
          {t("reviewsTitleA")} <span className="editorial-italic text-muted">{t("reviewsTitleB")}</span>
        </h2>
        <ExampleChip label={t("example")} />
      </div>
      {/* A slow strip that pauses under the pointer; the copy is duplicated for a seamless loop. */}
      <div className="review-strip mt-12 -mx-5 overflow-hidden sm:-mx-8">
        <ul className="review-track flex w-max gap-5 px-5 sm:px-8">
          {[...items, ...items].map((r, i) => (
            <li
              key={i}
              aria-hidden={i >= items.length || undefined}
              className="flex w-[min(80vw,360px)] shrink-0 flex-col justify-between gap-8 rounded-[var(--radius-card)] border border-hairline bg-bg p-6"
            >
              <div>
                <p className="flex gap-0.5" role="img" aria-label={t("stars", { n: 5 })}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <Star key={k} className="size-4 fill-ink text-ink" strokeWidth={1.5} aria-hidden="true" />
                  ))}
                </p>
                <blockquote className="mt-5 text-lg leading-relaxed">“{r.quote}”</blockquote>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-surface font-semibold" aria-hidden="true">
                  {r.name.slice(0, 1)}
                </span>
                <div className="text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-muted">{r.laptop}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-sm text-muted">{t("reviewsNote")}</p>
    </section>
  );
}

/* ---------- Pricing ---------- */

export async function Pricing() {
  const t = await getTranslations("more");
  const free = t.raw("priceFreeItems") as string[];
  const shop = t.raw("priceShopItems") as string[];
  return (
    <section id="pricing" data-fx="sheet" className="bg-surface">
      <div className="mx-auto max-w-5xl scroll-mt-20 px-5 py-24 sm:px-8 sm:py-28">
        <h2 className={`reveal text-center ${heading}`}>
          {t("priceTitleA")} <span className="editorial-italic text-muted">{t("priceTitleB")}</span>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div data-fx="parallax" data-speed="18" className="flex flex-col rounded-[var(--radius-card)] border border-ink bg-bg p-7">
            <p className="font-medium">{t("priceFreeName")}</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight">{t("priceFreeValue")}</span>
              <span className="text-muted">{t("priceFreeUnit")}</span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3">
              {free.map((f) => (
                <li key={f} className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/editor" className="mt-8 rounded-full bg-accent px-5 py-3 text-center font-semibold text-accent-ink">
              {t("priceFreeCta")}
            </Link>
          </div>
          <div data-fx="parallax" data-speed="-18" className="flex flex-col rounded-[var(--radius-card)] border border-dashed border-hairline bg-bg p-7">
            <div className="flex items-center justify-between">
              <p className="font-medium">{t("priceShopName")}</p>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium">{t("priceSoon")}</span>
            </div>
            <p className="mt-3 text-5xl font-semibold tracking-tight text-muted">{t("priceShopValue")}</p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-muted">
              {shop.map((f) => (
                <li key={f} className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/login?next=%2Fonboarding"
              className="mt-8 rounded-full border border-hairline px-5 py-3 text-center font-semibold transition-colors hover:border-ink"
            >
              {t("priceShopCta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Where to print (kinds of places, not named partners) ---------- */

const PRINT_PLACES = [
  { key: "home", icon: Home, tint: "#FFE7A3" },
  { key: "copy", icon: Printer, tint: "#D4F0FF" },
  { key: "digital", icon: Store, tint: "#E2DBFF" },
  { key: "diecut", icon: Scissors, tint: "#FFD4CC" },
  { key: "campus", icon: GraduationCap, tint: "#C9F2D2" },
  { key: "online", icon: Globe, tint: "#F4F6F8" },
] as const;

/** A printer feeding out a PeelPlan guide sheet as the page scrolls. */
function PrinterArt() {
  const ink = "#2B2320";
  return (
    <svg data-fx="print" viewBox="0 0 220 172" className="mt-10 h-auto w-full max-w-sm" aria-hidden="true">
      <defs>
        <clipPath id="print-out">
          <rect x="0" y="88" width="220" height="84" />
        </clipPath>
      </defs>
      <g clipPath="url(#print-out)">
        <g data-fx-paper>
          <rect x="52" y="86" width="116" height="82" rx="2" fill="#fff" stroke="#D9D9DE" strokeWidth="1.2" />
          <g fill="none" stroke="#FF7A59" strokeWidth="1.3" strokeDasharray="3 2.4">
            <rect data-fx-ink x="62" y="96" width="34" height="24" rx="6" />
            <circle data-fx-ink cx="125" cy="109" r="13" />
            <rect data-fx-ink x="104" y="128" width="52" height="16" rx="8" />
            <path data-fx-ink d="M74 128l8 16H66z" strokeLinejoin="round" />
          </g>
          <g data-fx-ink stroke={ink} strokeWidth="0.8">
            <path d="M62 156h96M62 153v6M158 153v6" />
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M${62 + (i + 1) * 9.6} 154.5v3`} />
            ))}
          </g>
          <text data-fx-ink x="110" y="165" textAnchor="middle" fontSize="6" fill={ink} fontFamily="var(--font-sans)">
            100 mm
          </text>
        </g>
      </g>
      <rect x="22" y="22" width="176" height="20" rx="8" fill="#F4F4F6" stroke={ink} strokeWidth="2.2" />
      <rect x="14" y="38" width="192" height="52" rx="12" fill="#E9E9EC" stroke={ink} strokeWidth="2.5" />
      <path d="M46 88h128" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <circle cx="184" cy="54" r="3.5" fill="#30a46c" />
      <rect x="30" y="50" width="40" height="8" rx="4" fill="#fff" stroke={ink} strokeWidth="1.5" />
      <path d="M26 46q6-4 14-4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export async function PrintPartners() {
  const t = await getTranslations("more");
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="reveal">
          <h2 className={heading}>
            {t("printTitleA")} <span className="editorial-italic text-muted">{t("printTitleB")}</span>
          </h2>
          <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-muted">{t("printBody")}</p>
          <PrinterArt />
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {PRINT_PLACES.map(({ key, icon: Icon, tint }, i) => (
            <li
              key={key}
              className="reveal flex flex-col justify-between gap-6 rounded-2xl border border-hairline bg-bg p-4 transition-transform duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="grid size-10 place-items-center rounded-xl" style={{ background: tint }} aria-hidden="true">
                <Icon className="size-5 text-[#2B2320]" strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-medium">{t(`print.${key}.title`)}</p>
                <p className="mt-1 text-xs tabular-nums text-muted">{t(`print.${key}.meta`)}</p>
              </div>
            </li>
          ))}
          <li
            className="reveal col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-hairline p-4 sm:col-span-3"
            style={{ transitionDelay: "360ms" }}
          >
            <div>
              <p className="font-medium">{t("printYou")}</p>
              <p className="mt-1 text-xs text-muted">{t("printYouBody")}</p>
            </div>
            <Plus className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
          </li>
        </ul>
      </div>
      <p className="reveal mt-8 text-sm text-muted">{t("printNote")}</p>
    </section>
  );
}
