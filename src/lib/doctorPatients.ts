import { supabase } from "@/integrations/supabase/client";

/** Name and contact details staff see for a practice patient. */
export interface PatientContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_e164: string | null;
  date_of_birth: string | null;
}

/**
 * Names and contact details for patients in the staff member's practice.
 * Row-level security limits results to practices the user works in.
 */
export const fetchPatientContacts = async (patientIds: string[]): Promise<PatientContact[]> => {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name, email, phone_e164, date_of_birth")
    .in("id", ids);
  if (error) {
    console.error("Could not load patient names:", error.message);
    return [];
  }
  return data ?? [];
};

export const patientName = (p?: { first_name: string | null; last_name: string | null } | null) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Patient";
