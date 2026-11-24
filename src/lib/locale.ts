import type { Database } from "@/integrations/supabase/types";

export type CountryCode = Database["public"]["Enums"]["country_code"];
export type CurrencyCode = Database["public"]["Enums"]["currency_code"];
export type NationalIdType = Database["public"]["Enums"]["national_id_type"];

/** Everything that differs between the countries we serve. Never hardcode these elsewhere. */
export const COUNTRIES: Record<
  CountryCode,
  {
    name: string;
    currency: CurrencyCode;
    timezone: string;
    locale: string;
    dialCode: string;
    council: "BHPC" | "HPCSA";
    idTypes: NationalIdType[];
  }
> = {
  BW: {
    name: "Botswana",
    currency: "BWP",
    timezone: "Africa/Gaborone",
    locale: "en-BW",
    dialCode: "267",
    council: "BHPC",
    idTypes: ["omang", "passport", "other"],
  },
  ZA: {
    name: "South Africa",
    currency: "ZAR",
    timezone: "Africa/Johannesburg",
    locale: "en-ZA",
    dialCode: "27",
    council: "HPCSA",
    idTypes: ["sa_id", "passport", "other"],
  },
};

export const ID_TYPE_LABELS: Record<NationalIdType, string> = {
  omang: "Omang",
  sa_id: "SA ID",
  passport: "Passport",
  other: "Other ID",
  none: "No ID",
};

const CURRENCY_LOCALE: Record<CurrencyCode, string> = { BWP: "en-BW", ZAR: "en-ZA" };

/** "P450.00" (BWP) or "R 450,00" (ZAR), in the currency's own convention. */
export const formatMoney = (amount: number | null | undefined, currency: CurrencyCode): string => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—";
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], { style: "currency", currency }).format(Number(amount));
};

/** Unambiguous date in the practice's time zone, e.g. "26 Nov 2026". */
export const formatDate = (iso: string | Date, timezone: string): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: timezone }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );

/** 24-hour time in the practice's time zone, e.g. "14:30". */
export const formatTime = (iso: string | Date, timezone: string): string =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );

export const formatDateTime = (iso: string | Date, timezone: string): string =>
  `${formatDate(iso, timezone)}, ${formatTime(iso, timezone)}`;

/** A calendar date (YYYY-MM-DD, e.g. a birth date) without any time-zone shift. */
export const formatCalendarDate = (ymd: string): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  return formatDate(new Date(Date.UTC(y, m - 1, d, 12)), "UTC");
};

const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Normalises a phone number to E.164 (+26771234567 / +27821234567).
 * Accepts international (+ or 00) or local formats for the practice's country.
 * Returns null if it can't be a valid number.
 */
export const normalizePhone = (input: string, country: CountryCode): string | null => {
  const raw = input.trim();
  if (!raw) return null;
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) return E164.test(digits) ? digits : null;
  if (!/^\d+$/.test(digits)) return null;

  const { dialCode } = COUNTRIES[country];
  if (digits.startsWith(dialCode) && digits.length > dialCode.length + 6) {
    const candidate = `+${digits}`;
    return E164.test(candidate) ? candidate : null;
  }
  if (country === "ZA") {
    // Local South African numbers are 10 digits starting with 0.
    return /^0\d{9}$/.test(digits) ? `+27${digits.slice(1)}` : null;
  }
  // Botswana numbers have no trunk prefix: 8 digits (mobile) or 7 digits (landline).
  return /^\d{7,8}$/.test(digits) ? `+267${digits}` : null;
};

/** "+267 71 234 567"-style display; falls back to the raw value. */
export const formatPhone = (e164: string | null | undefined): string => {
  if (!e164) return "";
  for (const { dialCode } of Object.values(COUNTRIES)) {
    if (e164.startsWith(`+${dialCode}`)) {
      const rest = e164.slice(dialCode.length + 1);
      return `+${dialCode} ${rest.replace(/(\d{2})(\d{3})(\d+)/, "$1 $2 $3")}`;
    }
  }
  return e164;
};

/** South African ID: 13 digits, a real YYMMDD birth date, and a valid Luhn checksum. */
export const isValidSaId = (id: string): boolean => {
  if (!/^\d{13}$/.test(id)) return false;
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let n = Number(id[12 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
};

/**
 * Checks a national ID for the chosen type.
 * - error: the value can't be right (blocks saving)
 * - warning: unusual but allowed (Omang format is still to be confirmed)
 */
export const checkNationalId = (type: NationalIdType, value: string): { error?: string; warning?: string } => {
  const v = value.trim();
  if (type === "none") return v ? { error: "Choose the ID type for this number." } : {};
  if (!v) return { error: "Enter the ID number, or choose \"No ID\"." };
  if (v.length < 3 || v.length > 30) return { error: "ID numbers are 3 to 30 characters." };
  if (type === "sa_id" && !isValidSaId(v)) return { error: "This isn't a valid South African ID number." };
  // TO CONFIRM: Omang numbers are believed to be 9 digits; warn rather than block until confirmed.
  if (type === "omang" && !/^\d{9}$/.test(v)) return { warning: "Omang numbers are usually 9 digits. Please double-check." };
  return {};
};

/** Offset (ms) of a time zone from UTC at a given instant. */
const zoneOffsetMs = (instant: Date, timezone: string): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(instant).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - instant.getTime();
};

/** A wall-clock date and time in a practice's time zone ("2026-11-26", "09:30") as a real instant. */
export const zonedTimeToDate = (ymd: string, hm: string, timezone: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(guess.getTime() - zoneOffsetMs(guess, timezone));
};

/** Today's date (YYYY-MM-DD) in a time zone. */
export const todayIn = (timezone: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
