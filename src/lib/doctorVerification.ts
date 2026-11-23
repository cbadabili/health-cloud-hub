import type { Database } from "@/integrations/supabase/types";

export type RegistrationCouncil = Database["public"]["Enums"]["registration_council"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];
export type DoctorVerification = Database["public"]["Tables"]["doctor_verifications"]["Row"];

export const COUNCILS: Record<
  RegistrationCouncil,
  { label: string; country: string; numberHint: string; checkUrl: string; checkHint: string }
> = {
  HPCSA: {
    label: "HPCSA",
    country: "South Africa",
    numberHint: "e.g. MP0123456",
    // iRegister is linked from the HPCSA home page.
    checkUrl: "https://www.hpcsa.co.za",
    checkHint: "Search the number on the HPCSA iRegister (linked from the HPCSA home page).",
  },
  BHPC: {
    label: "BHPC",
    country: "Botswana",
    numberHint: "Your BHPC registration number",
    checkUrl: "https://www.moh.gov.bw/regulatory.html",
    checkHint:
      "BHPC has no public online register. Contact BHPC to confirm, or ask the doctor for a current certificate of good standing.",
  },
};

export const STATUS_LABELS: Record<VerificationStatus, string> = {
  not_submitted: "Details needed",
  pending: "Pending review",
  approved: "Verified",
  rejected: "Rejected",
};

/** Registration numbers: 3–40 characters after trimming (matches the database check). */
export const isValidRegistrationNumber = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.length <= 40;
};
