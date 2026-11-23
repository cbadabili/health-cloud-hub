import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * True when the doctor_verifications table doesn't exist yet, i.e. the
 * 20261123200000-doctor-verification migration hasn't been applied. In that
 * case the database isn't enforcing verification either, so the app keeps its
 * previous behaviour instead of locking doctors out.
 */
export const isVerificationTableMissing = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "PGRST205" ||
    error.code === "42P01" ||
    /doctor_verifications/.test(error.message ?? ""));

/** Registration numbers: 3–40 characters after trimming (matches the database check). */
export const isValidRegistrationNumber = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.length <= 40;
};

// --- Certificate upload ------------------------------------------------------

/** Private Supabase Storage bucket (see 20261123210000-doctor-certificates.sql). */
export const CERTIFICATE_BUCKET = "doctor-certificates";
export const CERTIFICATE_MAX_BYTES = 5 * 1024 * 1024;
export const CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const CERTIFICATE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/** BHPC has no public online register, so a certificate is the only evidence. */
export const isCertificateRequired = (council: RegistrationCouncil | "" | null | undefined) => council === "BHPC";

/** Returns an error message, or null if the file is acceptable. */
export const validateCertificateFile = (file: File): string | null => {
  if (!CERTIFICATE_TYPES.includes(file.type)) return "Please upload a PDF, JPG or PNG file.";
  if (file.size > CERTIFICATE_MAX_BYTES) return "The file is too large. The limit is 5 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
};

/** Files go in the doctor's own folder; storage policies only allow "<user id>/...". */
export const buildCertificatePath = (userId: string, file: File) => {
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  return `${userId}/${Date.now()}-${safeName || "certificate"}`;
};

/** Display name without the folder and timestamp prefix. */
export const certificateFileName = (path: string) => path.split("/").pop()?.replace(/^\d+-/, "") ?? path;

export const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Opens a certificate in a new tab via a signed URL that expires after 60 s.
 * The tab is opened synchronously (before the await) so popup blockers allow it.
 * Returns false if the link couldn't be created.
 */
export const openCertificate = async (path: string): Promise<boolean> => {
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(CERTIFICATE_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    tab?.close();
    return false;
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = data.signedUrl;
  } else {
    window.location.assign(data.signedUrl);
  }
  return true;
};
