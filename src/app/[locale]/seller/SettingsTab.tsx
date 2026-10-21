"use client";

import { Check, ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { fileToDataUrl, getStore } from "@/features/market/store";
import { normalizePromptPayId } from "@/features/market/promptpay";
import { LINK_KINDS, type Shop } from "@/features/market/types";
import { PromptPayQr } from "@/features/market/ui/PromptPayQr";
import { ariaFor, cardClass, Field, fieldClass, primaryBtn, TypeChips, UnsavedDialog, useUnsavedGuard } from "./ui";
import { validateSettings, type Errors, type SettingsDraft, type SettingsField } from "./validate";

const TINTS = [
  ["lime", "#E8F7B0"],
  ["pink", "#FFE3EC"],
  ["sky", "#DCEBFF"],
  ["butter", "#FFF1C9"],
  ["lavender", "#E6E0FF"],
  ["mint", "#D9F5EC"],
  ["grey", "#EFEFF1"],
] as const;

const toDraft = (s: Shop): SettingsDraft => ({
  name: s.name,
  about: s.about,
  city: s.city,
  tint: s.tint,
  logo: s.logo,
  cover: s.cover,
  shippingThb: String(s.shippingThb),
  freeShippingFromThb: s.freeShippingFromThb ? String(s.freeShippingFromThb) : "",
  productTypes: s.productTypes,
  promptpayId: s.promptpay?.id ?? "",
  promptpayName: s.promptpay?.name ?? "",
  links: Object.fromEntries(LINK_KINDS.map((k) => [k, s.links[k] ?? ""])) as SettingsDraft["links"],
});

export function SettingsTab({ shop }: { shop: Shop }) {
  const t = useTranslations("seller.settings");
  const te = useTranslations("seller.errors");
  const formRef = useRef<HTMLFormElement>(null);
  const [d, setD] = useState<SettingsDraft>(() => toDraft(shop));
  const [errors, setErrors] = useState<Errors<SettingsField>>({});
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error" | "full">("idle");
  const set = <K extends keyof SettingsDraft>(k: K, v: SettingsDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    if (state === "saved") setState("idle");
  };
  const err = (k: SettingsField) => (errors[k] ? te(errors[k]!) : undefined);
  const ppValid = !!normalizePromptPayId(d.promptpayId);
  /**
   * Edits that take an approved shop off sale until staff look again. The database decides this
   * (0004 `check_shop_rules`): name, about, product types and the PromptPay account.
   */
  const reReview =
    shop.status === "approved" &&
    (d.name.trim() !== shop.name ||
      d.about.trim() !== shop.about ||
      d.productTypes.join("\u0000") !== shop.productTypes.join("\u0000") ||
      (normalizePromptPayId(d.promptpayId) ?? "") !== (shop.promptpay?.id ?? "") ||
      d.promptpayName.trim() !== (shop.promptpay?.name ?? ""));
  // Compared with what was last saved (not the reloaded shop: the store normalises some fields).
  const [saved, setSaved] = useState(() => JSON.stringify(toDraft(shop)));
  const guard = useUnsavedGuard(JSON.stringify(d) !== saved);

  const submit = async () => {
    const { errors, patch } = validateSettings(d);
    setErrors(errors);
    if (!patch) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setState("saving");
    try {
      await (await getStore()).saveMyShop(shop.ownerId, patch);
      setSaved(JSON.stringify(d));
      setState("saved");
    } catch (e) {
      setState(e instanceof Error && e.message === "storage-full" ? "full" : "error");
    }
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-5 pt-2"
    >
      {/* Identity */}
      <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="s-identity">
        <h2 id="s-identity" className="text-lg font-semibold tracking-tight">
          {t("identity")}
        </h2>
        <Field id="s-name" label={t("name")} hint={shop.status === "approved" ? t("renameNote") : undefined} error={err("name")}>
          <input
            id="s-name"
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={80}
            autoComplete="organization"
            className={fieldClass}
            {...ariaFor("s-name", err("name"))}
          />
        </Field>
        <Field id="s-about" label={t("about")} hint={t("aboutHint")} error={err("about")}>
          <textarea
            id="s-about"
            value={d.about}
            onChange={(e) => set("about", e.target.value)}
            maxLength={1000}
            rows={4}
            className={`${fieldClass} h-auto py-3`}
            {...ariaFor("s-about", err("about"))}
          />
        </Field>
        <Field id="s-city" label={t("city")} hint={t("cityHint")} error={err("city")}>
          <input
            id="s-city"
            value={d.city}
            onChange={(e) => set("city", e.target.value)}
            maxLength={80}
            autoComplete="address-level1"
            className={fieldClass}
            {...ariaFor("s-city", err("city"))}
          />
        </Field>
        <TypeChips value={d.productTypes} onChange={(v) => set("productTypes", v)} error={err("productTypes")} />
      </section>

      {/* Look */}
      <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="s-look">
        <h2 id="s-look" className="text-lg font-semibold tracking-tight">
          {t("look")}
        </h2>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("tint")}</legend>
          <div className="flex flex-wrap gap-2">
            {TINTS.map(([tn, c]) => (
              <label
                key={c}
                className="relative cursor-pointer rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]"
              >
                <input
                  type="radio"
                  name="tint"
                  value={c}
                  checked={d.tint === c}
                  onChange={() => set("tint", c)}
                  className="sr-only"
                  aria-label={t(`tints.${tn}`)}
                />
                <span
                  className={`grid size-10 place-items-center rounded-full border ${d.tint === c ? "border-ink" : "border-hairline"}`}
                  style={{ background: c }}
                  aria-hidden="true"
                >
                  {d.tint === c && <Check className="size-4 text-[#111]" strokeWidth={2.25} />}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <ImageField id="s-logo" label={t("logo")} hint={t("logoHint")} value={d.logo} onChange={(v) => set("logo", v)} square tint={d.tint} />
          <ImageField id="s-cover" label={t("cover")} hint={t("coverHint")} value={d.cover} onChange={(v) => set("cover", v)} tint={d.tint} />
        </div>
      </section>

      {/* Shipping */}
      <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="s-ship">
        <h2 id="s-ship" className="text-lg font-semibold tracking-tight">
          {t("shipping")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-fee" label={t("shippingFee")} hint={t("shippingFeeHint")} error={err("shippingThb")}>
            <input
              id="s-fee"
              inputMode="numeric"
              value={d.shippingThb}
              onChange={(e) => set("shippingThb", e.target.value)}
              className={fieldClass}
              {...ariaFor("s-fee", err("shippingThb"))}
            />
          </Field>
          <Field id="s-free" label={t("freeFrom")} hint={t("freeFromHint")} error={err("freeShippingFromThb")}>
            <input
              id="s-free"
              inputMode="numeric"
              value={d.freeShippingFromThb}
              onChange={(e) => set("freeShippingFromThb", e.target.value)}
              className={fieldClass}
              {...ariaFor("s-free", err("freeShippingFromThb"))}
            />
          </Field>
        </div>
      </section>

      {/* PromptPay */}
      <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="s-pp">
        <div>
          <h2 id="s-pp" className="text-lg font-semibold tracking-tight">
            {t("promptpay")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("promptpayBody")}</p>
        </div>
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Field id="s-ppid" label={t("promptpayId")} hint={t("promptpayIdHint")} error={err("promptpayId")}>
              <input
                id="s-ppid"
                inputMode="numeric"
                autoComplete="off"
                value={d.promptpayId}
                onChange={(e) => set("promptpayId", e.target.value)}
                className={fieldClass}
                {...ariaFor("s-ppid", err("promptpayId"))}
              />
            </Field>
            <Field id="s-ppname" label={t("promptpayName")} hint={t("promptpayNameHint")} error={err("promptpayName")}>
              <input
                id="s-ppname"
                value={d.promptpayName}
                onChange={(e) => set("promptpayName", e.target.value)}
                maxLength={120}
                className={fieldClass}
                {...ariaFor("s-ppname", err("promptpayName"))}
              />
            </Field>
          </div>
          <div className="flex flex-col items-center gap-2 sm:w-48">
            <PromptPayQr id={d.promptpayId} size={176} label={ppValid ? t("qrLabel") : t("qrEmpty")} />
            {ppValid && <p className="text-center text-xs text-muted">{t("qrCheck")}</p>}
          </div>
        </div>
      </section>

      {/* Links */}
      <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="s-links">
        <div>
          <h2 id="s-links" className="text-lg font-semibold tracking-tight">
            {t("links")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("linksBody")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {LINK_KINDS.map((k) => (
            <Field key={k} id={`s-link-${k}`} label={t(`linkKinds.${k}`)} error={err(`link_${k}`)}>
              <input
                id={`s-link-${k}`}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder={t(`linkPlaceholders.${k}`)}
                value={d.links[k]}
                onChange={(e) => set("links", { ...d.links, [k]: e.target.value })}
                className={fieldClass}
                {...ariaFor(`s-link-${k}`, err(`link_${k}`))}
              />
            </Field>
          ))}
        </div>
      </section>

      {/* Next to Save, where it is read before saving, not next to whichever field was edited. */}
      {reReview && (
        <p role="status" className="rounded-xl bg-[#FFF1C9] px-3 py-2 text-sm text-[#6B4E00]">
          {t("renameWarning")}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-hairline bg-bg/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <button type="submit" disabled={state === "saving"} className={primaryBtn}>
          {state === "saving" ? t("saving") : t("save")}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {state === "saved" && (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              {t("saved")}
            </span>
          )}
          {state === "error" && <span className="text-[#C62F35]">{te("save")}</span>}
          {state === "full" && <span className="text-[#C62F35]">{te("storageFull")}</span>}
          {Object.keys(errors).length > 0 && state === "idle" && <span className="text-[#C62F35]">{te("fixFields")}</span>}
        </p>
      </div>

      <UnsavedDialog guard={guard} />
    </form>
  );
}

function ImageField({
  id,
  label,
  hint,
  value,
  onChange,
  square = false,
  tint,
}: {
  id: string;
  label: string;
  hint: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  square?: boolean;
  tint: string;
}) {
  const t = useTranslations("seller.settings");
  const te = useTranslations("seller.errors");
  const [bad, setBad] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Field id={id} label={label} hint={hint} error={bad ? te("badImage") : undefined}>
        <div
          className={`grid place-items-center overflow-hidden rounded-xl border border-hairline ${square ? "size-24" : "aspect-[3/1] w-full"}`}
          style={{ background: tint }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URLs in test mode
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6 text-[#111]/50" strokeWidth={1.5} aria-hidden="true" />
          )}
        </div>
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              setBad(false);
              onChange(await fileToDataUrl(file, square ? 400 : 1400));
            } catch {
              setBad(true);
            }
          }}
          className="block w-full max-w-full text-sm file:mr-3 file:rounded-full file:border file:border-hairline file:bg-bg file:px-4 file:py-2 file:text-sm file:font-medium hover:file:border-ink"
          {...ariaFor(id, bad ? "x" : undefined)}
        />
      </Field>
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-[#C62F35]"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          {t("removeImage")}
        </button>
      )}
    </div>
  );
}
