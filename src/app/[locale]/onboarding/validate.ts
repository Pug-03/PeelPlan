import { MIN_SHOP_OWNER_AGE, MIN_USER_AGE, PRODUCT_TYPES, ageOn } from "@/config/onboarding";

export type OnboardingErrors = Partial<
  Record<"displayName" | "birthDate" | "shopName" | "ownerName" | "productTypes" | "description" | "terms" | "form", string>
>;

export type OnboardingData = {
  displayName: string;
  birthDate: string;
  isShop: boolean;
  shop: { name: string; ownerName: string; productTypes: string[]; description: string } | null;
};

/** YYYY-MM-DD that exists on the calendar (Date.parse accepts 2000-02-31; Postgres does not). */
function isCalendarDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * Shared by the server action and the device-only test mode, so both enforce the same rules
 * (the database re-checks age and status rules on top). `values` echoes the submission.
 */
export function validateOnboarding(form: FormData, today = new Date()) {
  const errors: OnboardingErrors = {};
  const displayName = str(form, "displayName");
  const birthDate = str(form, "birthDate");
  const isShop = str(form, "isShop") === "yes";
  const terms = form.get("terms") === "on";

  if (displayName.length < 1 || displayName.length > 80) errors.displayName = "name";
  const validDate = isCalendarDate(birthDate);
  const age = validDate ? ageOn(birthDate, today) : NaN;
  if (!validDate || age > 120 || age < 0) errors.birthDate = "birthDate";
  else if (age < MIN_USER_AGE) errors.birthDate = "tooYoung";
  if (!terms) errors.terms = "terms";

  let shop: OnboardingData["shop"] = null;
  if (isShop) {
    const name = str(form, "shopName");
    const ownerName = str(form, "ownerName");
    const types = form
      .getAll("productTypes")
      .map(String)
      .filter((t) => (PRODUCT_TYPES as readonly string[]).includes(t));
    const description = str(form, "description");
    if (validDate && age >= MIN_USER_AGE && age < MIN_SHOP_OWNER_AGE) errors.birthDate = "shopTooYoung";
    if (name.length < 2 || name.length > 80) errors.shopName = "shopName";
    if (ownerName.length < 2 || ownerName.length > 120) errors.ownerName = "ownerName";
    if (!types.length) errors.productTypes = "productTypes";
    if (description.length > 1000) errors.description = "description";
    shop = { name, ownerName, productTypes: types, description };
  }
  const values: Record<string, string | string[]> = {
    displayName,
    birthDate,
    isShop: isShop ? "yes" : "no",
    shopName: str(form, "shopName"),
    ownerName: str(form, "ownerName"),
    description: str(form, "description"),
    productTypes: form.getAll("productTypes").map(String),
    terms: terms ? "on" : "",
  };
  const data: OnboardingData = { displayName, birthDate, isShop, shop };
  return { errors, values, data };
}
