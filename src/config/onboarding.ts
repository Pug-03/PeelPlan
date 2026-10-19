/**
 * Sign-up rules. Mirrored by triggers in supabase/migrations/0001_profiles_shops.sql; change both together.
 * Thailand: majority is 20 (Civil and Commercial Code s.19), so shop owners must be 20+ to sign seller terms.
 */
export const MIN_USER_AGE = 13;
export const MIN_SHOP_OWNER_AGE = 20;

export const PRODUCT_TYPES = ["die-cut", "sheet", "holographic", "clear", "vinyl", "custom"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Whole years between a YYYY-MM-DD birth date and `today`. */
export function ageOn(birthDate: string, today = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age--;
  return age;
}
