"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { MIN_SHOP_OWNER_AGE, MIN_USER_AGE, PRODUCT_TYPES } from "@/config/onboarding";
import { useRouter } from "@/i18n/navigation";
import { afterAuthPath } from "@/lib/safe-path";
import { saveDemoProfile, useSession } from "@/lib/session";
import { completeOnboarding, type OnboardingState } from "./actions";
import { validateOnboarding, type OnboardingErrors } from "./validate";

const fieldClass =
  "h-11 w-full rounded-xl border border-hairline bg-bg px-3.5 text-base outline-none transition-colors focus:border-ink aria-[invalid=true]:border-[#E5484D]";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-[#C62F35]">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function OnboardingForm({ defaultName, next, preview = false }: { defaultName: string; next: string; preview?: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [isShop, setIsShop] = useState(false);
  const [serverState, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, { ok: false, errors: {} });
  // Test mode validates on the device with the same rules as the server action.
  const [previewState, setPreviewState] = useState<OnboardingState | null>(null);
  const state = previewState ?? serverState;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (serverState.ok) router.replace(afterAuthPath(serverState.next));
  }, [serverState, router]);

  // Move focus to the first field that needs fixing so keyboard and screen reader users land on it.
  useEffect(() => {
    if (Object.keys(state.errors).length) formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [state]);

  const err = (k: keyof OnboardingErrors) => {
    const code = state.errors[k];
    if (!code) return undefined;
    if (code === "tooYoung") return t("errors.tooYoung", { age: MIN_USER_AGE });
    if (code === "shopTooYoung") return t("errors.shopTooYoung", { age: MIN_SHOP_OWNER_AGE });
    return t(`errors.${code}` as "errors.required");
  };
  const aria = (k: keyof OnboardingErrors, id: string) => ({
    "aria-invalid": state.errors[k] ? true : undefined,
    "aria-describedby": state.errors[k] ? `${id}-error` : `${id}-hint`,
  });
  const today = new Date().toISOString().slice(0, 10);
  // Test mode needs the simulated sign-in first; once the profile is saved here, carry on to `next`.
  const session = useSession();
  const hasProfile = session.status === "signed-in" && !!session.session.profile;
  useEffect(() => {
    if (!preview) return;
    if (session.status === "signed-out") router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    else if (hasProfile) router.replace(afterAuthPath(next));
  }, [preview, session.status, hasProfile, next, router]);
  const v = (k: string) => (typeof state.values?.[k] === "string" ? (state.values[k] as string) : undefined);
  const picked = (state.values?.productTypes as string[] | undefined) ?? [];

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (!preview) return;
        // Test mode: the profile is saved on this device instead of the database; the effect above
        // then moves on once the session reports the profile.
        e.preventDefault();
        const { errors, values, data } = validateOnboarding(new FormData(e.currentTarget));
        if (Object.keys(errors).length) return setPreviewState({ ok: false, errors, values });
        setPreviewState(null);
        saveDemoProfile({
          displayName: data.displayName,
          birthDate: data.birthDate,
          isShop: data.isShop,
          shop: data.shop ?? undefined,
          onboardedAt: new Date().toISOString(),
        });
      }}
      noValidate
      className="mt-8 flex flex-col gap-6 rounded-[var(--radius-card)] border border-hairline bg-bg p-6 shadow-soft sm:p-8"
    >
      <input type="hidden" name="next" value={next} />
      {state.errors.form && (
        <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm">
          {t("errors.server")}
        </p>
      )}

      <Field id="displayName" label={t("displayName")} hint={t("displayNameHint")} error={err("displayName")}>
        <input
          id="displayName"
          name="displayName"
          defaultValue={v("displayName") ?? defaultName}
          maxLength={80}
          autoComplete="name"
          required
          className={fieldClass}
          {...aria("displayName", "displayName")}
        />
      </Field>

      <Field id="birthDate" label={t("birthDate")} hint={t("birthDateHint")} error={err("birthDate")}>
        <input
          id="birthDate"
          name="birthDate"
          defaultValue={v("birthDate")}
          type="date"
          max={today}
          autoComplete="bday"
          required
          className={fieldClass}
          {...aria("birthDate", "birthDate")}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t("isShop")}</legend>
        {(["no", "yes"] as const).map((v) => (
          <label
            key={v}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-hairline px-4 py-3 has-[:checked]:border-ink has-[:checked]:bg-surface"
          >
            <input
              type="radio"
              name="isShop"
              value={v}
              checked={isShop === (v === "yes")}
              onChange={() => setIsShop(v === "yes")}
              className="size-4 accent-[var(--text)]"
            />
            <span className="text-sm">{v === "yes" ? t("isShopYes") : t("isShopNo")}</span>
          </label>
        ))}
      </fieldset>

      {isShop && (
        <section aria-label={t("shopSection")} className="flex flex-col gap-5 border-t border-hairline pt-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("shopSection")}</h2>
            <p className="mt-1 text-sm text-muted">{t("shopNote")}</p>
          </div>
          <Field id="shopName" label={t("shopName")} error={err("shopName")}>
            <input
              id="shopName"
              name="shopName"
              defaultValue={v("shopName")}
              maxLength={80}
              autoComplete="organization"
              className={fieldClass}
              {...aria("shopName", "shopName")}
            />
          </Field>
          <Field id="ownerName" label={t("ownerName")} hint={t("ownerNameHint")} error={err("ownerName")}>
            <input id="ownerName" name="ownerName" defaultValue={v("ownerName")} maxLength={120} className={fieldClass} {...aria("ownerName", "ownerName")} />
          </Field>
          <fieldset aria-describedby={state.errors.productTypes ? "productTypes-error" : undefined}>
            <legend className="mb-2 text-sm font-medium">{t("productTypes")}</legend>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TYPES.map((p) => (
                <label
                  key={p}
                  className="cursor-pointer rounded-full border border-hairline px-3.5 py-2 text-sm transition-colors has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2"
                >
                  <input type="checkbox" name="productTypes" value={p} defaultChecked={picked.includes(p)} className="sr-only" />
                  {t(`products.${p}`)}
                </label>
              ))}
            </div>
            {state.errors.productTypes && (
              <p id="productTypes-error" className="mt-2 text-sm text-[#C62F35]">
                {err("productTypes")}
              </p>
            )}
          </fieldset>
          <Field id="description" label={t("description")} hint={t("descriptionHint")} error={err("description")}>
            <textarea
              id="description"
              name="description"
              defaultValue={v("description")}
              maxLength={1000}
              rows={4}
              className={`${fieldClass} h-auto py-3`}
              {...aria("description", "description")}
            />
          </Field>
        </section>
      )}

      <div className="flex flex-col gap-1.5 border-t border-hairline pt-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="terms"
            defaultChecked={v("terms") === "on"}
            className="mt-1 size-4 shrink-0 accent-[var(--text)]"
            aria-invalid={state.errors.terms ? true : undefined}
            aria-describedby={state.errors.terms ? "terms-error" : undefined}
          />
          <span>{t("terms")}</span>
        </label>
        {state.errors.terms && (
          <p id="terms-error" className="pl-7 text-sm text-[#C62F35]">
            {err("terms")}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-ink text-base font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
