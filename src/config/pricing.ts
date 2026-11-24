import type { CountryCode, CurrencyCode } from "@/lib/locale";

export type PlanName = "Basic" | "Pro" | "Premium";

/**
 * Monthly plan prices per currency. `null` means the price hasn't been set yet,
 * and the site shows "Contact us" instead of guessing.
 *
 * FOUNDER TO CONFIRM: Botswana (BWP) prices.
 */
export const PLAN_PRICES: Record<PlanName, Record<CurrencyCode, number | null>> = {
  Basic: { ZAR: 999, BWP: null },
  Pro: { ZAR: 2499, BWP: null },
  Premium: { ZAR: 4999, BWP: null },
};

/** Which country the pricing section shows first. */
export const DEFAULT_PRICING_COUNTRY: CountryCode = "BW";
