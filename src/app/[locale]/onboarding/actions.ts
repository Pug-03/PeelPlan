"use server";

import { safePath } from "@/lib/safe-path";
import { createSupabaseServer } from "@/lib/supabase/server";
import { validateOnboarding, type OnboardingErrors } from "./validate";

/** `values` echoes the submission so fields keep their input after React resets the form. */
export type OnboardingState = { ok: boolean; errors: OnboardingErrors; next?: string; values?: Record<string, string | string[]> };

/** Validates on the server (the database re-checks age and status rules) and saves profile + shop. */
export async function completeOnboarding(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, errors: { form: "server" } };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { form: "server" } };

  const { errors, values, data } = validateOnboarding(form);
  if (Object.keys(errors).length) return { ok: false, errors, values };

  // One RPC: profile + shop in a single transaction, guarded against re-onboarding (see migration).
  const { error } = await supabase.rpc("complete_onboarding", {
    p_display_name: data.displayName,
    p_birth_date: data.birthDate,
    p_is_shop: data.isShop,
    p_shop_name: data.shop?.name ?? null,
    p_owner_name: data.shop?.ownerName ?? null,
    p_product_types: data.shop?.productTypes ?? null,
    p_description: data.shop?.description ?? "",
  });
  if (error) return { ok: false, errors: { form: "server" }, values };

  return { ok: true, errors: {}, next: safePath(String(form.get("next") ?? ""), "") || undefined };
}
