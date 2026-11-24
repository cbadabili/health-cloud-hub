import type { PracticeRole } from "@/hooks/usePractice";

export const ROLE_LABELS: Record<PracticeRole, string> = {
  owner: "Owner",
  manager: "Practice manager",
  receptionist: "Receptionist",
  nurse: "Nurse",
  clinician: "Clinician",
  biller: "Biller",
};

export const ROLE_DESCRIPTIONS: Record<PracticeRole, string> = {
  owner: "Full control, including other owners",
  manager: "Runs the practice: staff, sites, settings, audit log",
  receptionist: "Registers patients and manages the diary",
  nurse: "Registers and updates patients",
  clinician: "Sees patients and writes notes and prescriptions",
  biller: "Invoices and payments",
};

/** Roles that can register and update patient details. */
export const FRONT_DESK_ROLES: PracticeRole[] = ["owner", "manager", "receptionist", "nurse", "clinician"];

/** Friendly text for the error codes raised by the practice functions. */
export const practiceErrorMessage = (error: { message?: string } | null, fallback = "Something went wrong. Please try again.") => {
  const m = error?.message ?? "";
  const map: [string, string][] = [
    ["INVITATION_NOT_FOUND", "This invitation link isn't valid. Ask your practice for a new one."],
    ["INVITATION_ALREADY_USED", "This invitation has already been used."],
    ["INVITATION_EXPIRED", "This invitation has expired. Ask your practice to send a new one."],
    ["INVITATION_EMAIL_MISMATCH", "This invitation was sent to a different email address. Sign in with that address instead."],
    ["ONLY_OWNERS_CAN_INVITE_OWNERS", "Only an owner can invite another owner."],
    ["ONLY_OWNERS_CAN_REMOVE_OWNERS", "Only an owner can remove another owner."],
    ["LAST_OWNER", "A practice needs at least one owner. Add another owner first."],
    ["INVALID_EMAIL", "Please enter a valid email address."],
    ["INVALID_NAME", "Please enter a name."],
    ["INVALID_SITES", "Choose at least one site, or allow all sites."],
    ["ALREADY_MERGED", "One of these records has already been merged."],
    ["INVALID_PATIENTS", "Choose two different patient records."],
    ["REASON_REQUIRED", "Please give a reason (at least 3 characters)."],
    ["CROSS_PRACTICE_REFERENCE", "Those records belong to different practices."],
    ["NOT_ALLOWED", "Your role doesn't allow this."],
    ["NOT_SIGNED_IN", "Please sign in again."],
    ["patients_phone_e164_check", "That phone number isn't valid."],
    ["duplicate key", "That already exists."],
  ];
  return map.find(([code]) => m.includes(code))?.[1] ?? fallback;
};

export const SEX_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  unknown: "Not recorded",
};
