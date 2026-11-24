/** Bookable start times (local time), 30-minute slots. */
export const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

/** "2026-11-26" + "09:30" in the user's local time zone -> Date. */
export const slotToDate = (date: string, time: string) => new Date(`${date}T${time}:00`);

/** Local "HH:MM" for a timestamp, matching the TIME_SLOTS format. */
export const toSlotTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Start and end (exclusive) of a local calendar day, for querying booked slots. */
export const localDayRange = (date: string) => {
  const from = new Date(`${date}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
};

/** Today's date as YYYY-MM-DD in local time (for the date picker's minimum). */
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const doctorName = (first: string | null | undefined, last: string | null | undefined) => {
  const name = [first, last].filter(Boolean).join(" ");
  return name ? `Dr. ${name}` : "Your doctor";
};

export const formatFee = (fee: number | null | undefined) =>
  fee === null || fee === undefined ? null : `R${Math.round(Number(fee)).toLocaleString("en-ZA")}`;

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
