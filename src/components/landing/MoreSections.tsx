import { ArrowRight, Check, Laptop, QrCode, Ruler, Star, Store } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LidArt, type ArtSticker } from "@/components/LidArt";
import { PACKED_DEV_LID } from "./packedLid";
import { LAPTOP_MODELS, getLaptopModel, lidGeometry } from "@/config/laptops";
import { Link } from "@/i18n/navigation";
import { stickerSrcById } from "@/stickers/library";
import { scatter } from "./scatter";

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
    // The new back-lit Pro: stickers kept to the corners so the glowing logo shows.
    modelId: "macbook-pro-16-proled",
    color: "#2B2B2D",
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
    // ScrollFx makes this section taller and slides the row while the sticky frame is held. Without
    // motion the row simply scrolls sideways.
    <section data-fx="hscroll" className="relative overflow-x-clip">
      <div data-fx-frame className="sticky top-0 h-svh overflow-hidden motion-reduce:overflow-x-auto">
        {/* Scrolling down moves this row to the left. */}
        <div data-fx-track className="flex h-full w-max items-center gap-8 px-5 sm:px-8 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
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
      </div>
    </section>
  );
}

/* ---------- Gallery ---------- */

/**
 * Gallery lids: every lid gets its own four stickers (no sticker repeats across the gallery).
 * Each set is laid out in the lid's four quadrants with a little rotation.
 */
/** Example lids with as few as three stickers and as many as a dozen, so the gallery doesn't repeat itself. */
const GALLERY_SETS: { modelId: string; color: string; ids: string[] }[] = [
  { modelId: "macbook-air-13-m5", color: "#C2CDD7", ids: ["p2-som-tam", "p2-pad-thai", "p2-cha-yen", "p2-mango"] },
  { modelId: "macbook-pro-14-m5", color: "#D9DADC", ids: ["p2-cat", "p2-pup", "p2-frog", "p2-capybara", "p2-bear", "p2-chick", "p2-hedgehog"] },
  { modelId: "macbook-neo-13", color: "#E2CDC8", ids: ["p2-lotus", "p2-paper-umbrella", "p2-daisy"] },
  { modelId: "macbook-air-15-m5", color: "#D6CCBC", ids: ["p2-rocket", "p2-ufo", "p2-saturn", "p2-alien", "p2-comet"] },
  {
    modelId: "macbook-pro-16-proled",
    color: "#2B2B2D",
    ids: ["p2-cassette", "p2-game-controller", "p2-headphones", "p2-boombox", "code-coder", "code-key-esc", "code-sym-braces", "code-say-lgtm", "code-rubber-duck"],
  },
  { modelId: "macbook-neo-13", color: "#DCDAB2", ids: ["p2-sun", "p2-rainbow", "p2-cactus"] },
  {
    modelId: "macbook-air-13-m5",
    color: "#CACBCE",
    ids: ["p2-su-su", "p2-555", "p2-heart", "p2-sparkle", "p2-mai-pen-rai", "p2-chill", "p2-wow-burst", "p2-oops", "p2-checkmark", "p2-twinkle-stars", "p2-tired-but-ok", "p2-hello"],
  },
  { modelId: "macbook-pro-14-proled", color: "#D9DADC", ids: ["p2-axolotl", "p2-penguin", "p2-jellyfish"] },
  { modelId: "macbook-air-15-m5", color: "#C2CDD7", ids: ["p2-durian", "p2-mangosteen", "p2-watermelon", "p2-coconut", "p2-chili", "p2-moo-ping"] },
  { modelId: "macbook-neo-13", color: "#CACBCE", ids: ["p2-longtail-boat", "p2-elephant-head", "p2-temple-roof", "p2-tuk-tuk"] },
  {
    modelId: "macbook-air-13-m5",
    color: "#D6CCBC",
    ids: ["p2-donut", "p2-pizza", "p2-burger", "p2-ice-cream", "p2-sushi", "p2-popsicle", "p2-coffee-mug", "p2-boba-matcha"],
  },
  { modelId: "macbook-pro-16-m5", color: "#D9DADC", ids: ["p2-fox", "p2-whale", "p2-octopus"] },
  {
    modelId: "macbook-pro-14-proled",
    color: "#2B2B2D",
    ids: ["p2-film-camera", "p2-polaroid", "p2-vinyl", "p2-floppy", "p2-laptop", "code-term-tests", "code-git-graph", "code-key-copy", "code-say-todo", "code-stamp-ship-it"],
  },
  { modelId: "macbook-neo-13", color: "#DCDAB2", ids: ["p2-good-vibes", "p2-smiley", "p2-peace-hand", "p2-stay-curious", "p2-jasmine-garland"] },
  { modelId: "macbook-air-15-m5", color: "#CACBCE", ids: ["p2-sleepy-moon", "p2-seedling", "p2-rain-cloud"] },
  {
    modelId: "macbook-air-13-m5",
    color: "#E2CDC8",
    ids: ["p2-boba-taro", "p2-roti", "p2-khanom-krok", "p2-dumpling", "p2-tom-yum", "p2-sticky-rice-basket"],
  },
];

const GALLERY: { modelId: string; color: string; stickers: ArtSticker[] }[] = GALLERY_SETS.map(({ modelId, color, ids }, i) => ({
  modelId,
  color,
  stickers: scatter(ids, lidGeometry(getLaptopModel(modelId)), i * 7919),
}));

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
/** Every lid outline drawn from the same corner at true relative size. */
function SizeOutlines() {
  const pad = 6;
  const maxW = Math.max(...LAPTOP_MODELS.map((m) => m.lid.widthMm.value));
  const maxH = Math.max(...LAPTOP_MODELS.map((m) => m.lid.heightMm.value));
  // Largest first so smaller lids sit on top.
  const models = [...LAPTOP_MODELS].sort((a, b) => b.lid.widthMm.value - a.lid.widthMm.value);
  // Ink outlines on a faint ink wash that deepens where lids overlap; hovering a table row picks that lid out in ink.
  return (
    <svg data-fx="draw" viewBox={`0 0 ${maxW + pad * 2} ${maxH + pad * 2}`} className="mt-10 h-auto w-full max-w-md overflow-visible" aria-hidden="true">
      {models.map((m) => {
        const w = m.lid.widthMm.value;
        const h = m.lid.heightMm.value;
        return (
          <g key={m.id} data-o={m.id} className="size-lid">
            <rect data-fx-path className="size-outline" x={pad} y={pad + maxH - h} width={w} height={h} rx={m.lid.cornerRadiusMm.value} />
          </g>
        );
      })}
      {/* Labels go on top of every outline. Several lids nearly share a top-right corner, so a label that would
          overlap one already placed steps left past it. */}
      {sizeLabels(models, pad, maxH).map(({ m, label, x, y }) => (
        <g key={m.id} data-o={m.id} className="size-lid">
          <text x={x} y={y} textAnchor="end" className="size-label">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Mono 8px label (see .size-label): about 5 viewBox units per character. */
const LABEL_CHAR = 5;
const LABEL_GAP = 6;

/** Each lid's label at its top-right corner, nudged left until it clears every label placed before it. */
function sizeLabels(models: typeof LAPTOP_MODELS, pad: number, maxH: number) {
  const placed: { left: number; right: number; top: number; bottom: number }[] = [];
  return models.map((m) => {
    const label = m.name.replace(/^MacBook /, "");
    const width = label.length * LABEL_CHAR;
    const y = pad + maxH - m.lid.heightMm.value + 8;
    let x = pad + m.lid.widthMm.value - 13;
    for (;;) {
      const hit = placed.find((b) => y - 7 < b.bottom && y + 2 > b.top && x - width < b.right && x > b.left);
      if (!hit) break;
      x = hit.left - LABEL_GAP;
    }
    placed.push({ left: x - width, right: x, top: y - 7, bottom: y + 2 });
    return { m, label, x, y };
  });
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
            className="cta-run cta-run-ink group mt-9 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition-transform duration-300 hover:-translate-y-0.5"
          >
            {t("sellCta")}
            <ArrowRight className="cta-run-arrow size-4" strokeWidth={2.25} aria-hidden="true" />
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
  const basic = t.raw("priceBasicItems") as string[];
  const plus = t.raw("pricePlusItems") as string[];
  // Ticks sit in small round chips; the top plan's are lime.
  const list = (items: string[], top = false) => (
    <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-hairline pt-6">
      {items.map((f) => (
        <li key={f} className="flex gap-3">
          <span
            className={`price-check mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${top ? "bg-[#D7FF3A] text-[#111]" : "bg-ink/[0.08]"}`}
            aria-hidden="true"
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
  const price = (value: string, unit: string) => (
    <p className="mt-3 flex items-baseline gap-2">
      <span className="text-5xl font-semibold tracking-tight">{value}</span>
      <span className="text-muted">{unit}</span>
    </p>
  );
  const trial = <span className="rounded-full bg-[#D7FF3A] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#111]">{t("priceTrial")}</span>;
  return (
    <section id="pricing" data-fx="sheet" className="bg-surface">
      <div className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8 sm:py-28">
        <h2 className={`reveal text-center ${heading}`}>
          {t("priceTitleA")} <span className="editorial-italic text-muted">{t("priceTitleB")}</span>
        </h2>
        <p className="reveal mx-auto mt-4 max-w-[52ch] text-center text-muted">{t("priceLead")}</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {/* Planners: always free. */}
          <div className="price-card flex flex-col rounded-[var(--radius-card)] border border-hairline bg-bg p-7">
            <p className="font-medium">{t("priceFreeName")}</p>
            {price(t("priceFreeValue"), t("priceFreeUnit"))}
            {list(free)}
            <Link href="/editor" className="cta-run mt-8 rounded-full bg-[#D7FF3A] px-5 py-3 text-center font-semibold text-[#111] transition-opacity hover:opacity-90">
              {t("priceFreeCta")}
            </Link>
          </div>

          {/* Shops: two monthly plans, both start with a free trial month. */}
          <div className="price-card flex flex-col rounded-[var(--radius-card)] border border-hairline bg-bg p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{t("priceBasicName")}</p>
              {trial}
            </div>
            {price(t("priceBasicValue"), t("priceMonth"))}
            {list(basic)}
            <Link
              href="/seller"
              className="cta-run cta-run-ink mt-8 rounded-full border border-ink px-5 py-3 text-center font-semibold transition-colors hover:bg-ink hover:text-bg"
            >
              {t("priceShopCta")}
            </Link>
          </div>

          <div className="price-card flex flex-col rounded-[var(--radius-card)] border-2 border-ink bg-bg bg-[radial-gradient(120%_70%_at_100%_0%,rgb(215_255_58/0.16),transparent_60%)] p-7 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{t("pricePlusName")}</p>
              {trial}
            </div>
            {price(t("pricePlusValue"), t("priceMonth"))}
            {list(plus, true)}
            <Link href="/seller" className="cta-run cta-run-ink mt-8 rounded-full bg-ink px-5 py-3 text-center font-semibold text-bg transition-opacity hover:opacity-90">
              {t("priceShopCta")}
            </Link>
          </div>
        </div>

        {/* Add-on for either shop plan: be the first shop people see. The little shop row shows what you get. */}
        <div className="price-card mt-5 grid items-center gap-6 rounded-[var(--radius-card)] border border-hairline bg-bg bg-[radial-gradient(90%_160%_at_72%_50%,rgb(215_255_58/0.16),transparent_60%)] p-7 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-10">
          <div>
            <span className="rounded-full border border-ink/15 px-2.5 py-0.5 text-xs font-medium text-muted">{t("priceBoostTag")}</span>
            <p className="mt-3 text-lg font-semibold">{t("priceBoostName")}</p>
            <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-muted">{t("priceBoostBody")}</p>
          </div>
          <div aria-hidden="true" className="hidden w-64 -rotate-2 flex-col gap-2 sm:flex">
            <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-bg p-3 shadow-soft">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#D7FF3A]">
                <Store className="size-4 text-[#111]" strokeWidth={2} />
              </span>
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="h-2 w-20 rounded-full bg-ink/70" />
                <span className="h-1.5 w-12 rounded-full bg-ink/20" />
              </span>
              <span className="flex items-center gap-1 rounded-full bg-[#D7FF3A] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#111]">
                <Star className="size-3 fill-current" strokeWidth={2} />
                {t("priceBoostName")}
              </span>
            </div>
            <div className="mx-2 flex items-center gap-3 rounded-2xl border border-hairline p-3 opacity-50">
              <span className="size-9 shrink-0 rounded-xl bg-ink/10" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="h-2 w-16 rounded-full bg-ink/30" />
                <span className="h-1.5 w-10 rounded-full bg-ink/15" />
              </span>
            </div>
          </div>
          <p className="flex items-baseline gap-1.5 md:flex-col md:items-end md:gap-0">
            <span className="text-4xl font-semibold tracking-tight">+{t("priceBoostValue")}</span>
            <span className="text-muted">{t("priceMonth")}</span>
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-muted">{t("priceNote")}</p>
      </div>
    </section>
  );
}

const BUY_STEPS = [
  { key: "pick", icon: Store },
  { key: "try", icon: Laptop },
  { key: "pay", icon: QrCode },
  { key: "stick", icon: Ruler },
] as const;

/** How buying works, from a shop's cart to stickers on the lid. */
export async function BuyFlow() {
  const t = await getTranslations("more");
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <div className="reveal flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-muted uppercase">{t("buyEyebrow")}</p>
          <h2 className={`mt-3 ${heading}`}>
            {t("buyTitleA")} <span className="editorial-italic text-muted">{t("buyTitleB")}</span>
          </h2>
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted">{t("buyLead")}</p>
        </div>
        <Link
          href="/shops"
          className="cta-run cta-run-ink group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-ink px-5 py-3 font-semibold transition-colors hover:bg-ink hover:text-bg md:self-auto"
        >
          {t("buyCta")}
          <ArrowRight className="cta-run-arrow size-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BUY_STEPS.map(({ key, icon: Icon }, i) => (
          // The reveal (and its stagger delay) lives on the <li>; the hover lift is on the card inside, so the
          // two transitions never fight and hovering isn't delayed.
          <li key={key} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="group flex h-full flex-col gap-8 rounded-2xl border border-hairline bg-bg p-5 transition-[translate,box-shadow,border-color] duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:border-ink/15 hover:shadow-soft">
              <div className="flex items-center justify-between">
                <span
                  // One quiet tile for every step; the brand lime only shows on the card you're pointing at.
                  className="grid size-11 place-items-center rounded-xl bg-ink/[0.06] text-ink transition-[transform,background-color,color] duration-300 ease-[var(--ease-out-soft)] group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-[#D7FF3A] group-hover:text-[#111]"
                  aria-hidden="true"
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="text-sm tabular-nums text-muted" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{t(`buy.${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(`buy.${key}.body`)}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="reveal mt-8 text-sm text-muted">{t("buyNote")}</p>
    </section>
  );
}
