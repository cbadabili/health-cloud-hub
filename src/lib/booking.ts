import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatTime, todayIn, zonedTimeToDate, type CurrencyCode } from "@/lib/locale";

/** Bookable start times (local time), 30-minute slots. */
export const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

/** "2026-11-26" + "09:30" in the practice's time zone -> Date. */
export const slotToDate = (date: string, time: string, timeZone: string) => zonedTimeToDate(date, time, timeZone);

/** "HH:MM" in the practice's time zone, matching the TIME_SLOTS format. */
export const toSlotTime = (iso: string, timeZone: string) => formatTime(iso, timeZone);

/** Start and end (exclusive) of a practice-local calendar day, for querying booked slots. */
export const localDayRange = (date: string, timeZone: string) => {
  const from = zonedTimeToDate(date, "00:00", timeZone);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
};

/** Today's date as YYYY-MM-DD in the given time zone (for the date picker's minimum). */
export const todayLocal = (timeZone: string) => todayIn(timeZone);

export const doctorName = (displayName: string | null | undefined) =>
  displayName ? (/^dr\.?\s/i.test(displayName) ? displayName : `Dr. ${displayName}`) : "Your doctor";

export const formatFee = (fee: number | null | undefined, currency: CurrencyCode) =>
  fee === null || fee === undefined ? null : formatMoney(Number(fee), currency);

/** Patient records this portal user is linked to (one per practice they've booked with). */
export const myPortalPatientIds = async (userId: string) => {
  const { data, error } = await supabase.from("patient_portal_links").select("patient_id").eq("user_id", userId);
  if (error) {
    console.error("Could not load your patient records:", error.message);
    return [];
  }
  return (data ?? []).map((l) => l.patient_id);
};

/**
 * True when the booking functions don't exist yet, i.e. the
 * 20261124090000-patient-booking migration hasn't been applied.
 */
export const isBookingNotSetUp = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "PGRST202" ||
    error.code === "42883" ||
    /Could not find the function/i.test(error.message ?? ""));

/** Friendly text for the error codes raised by public.book_appointment / cancel_my_appointment. */
export const bookingErrorMessage = (error: { message?: string } | null) => {
  const code = error?.message ?? "";
  if (code.includes("SLOT_TAKEN")) return "Sorry, that time has just been taken. Please choose another time.";
  if (code.includes("DOCTOR_NOT_AVAILABLE")) return "This doctor isn't available for online booking right now.";
  if (code.includes("TIME_IN_PAST")) return "Please choose a time in the future.";
  if (code.includes("TOO_FAR_AHEAD")) return "You can book up to a year ahead.";
  if (code.includes("INVALID_REASON")) return "Please describe the reason for your visit (3 to 1,000 characters).";
  if (code.includes("ONLY_PATIENTS_CAN_BOOK")) return "Only patient accounts can book appointments.";
  if (code.includes("NOT_CANCELLABLE")) return "This appointment can no longer be cancelled online. Please contact your practice.";
  return null;
};
