import { supabase } from "@/integrations/supabase/client";

/** What a verified doctor may see about their own patients. */
export interface PatientContact {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

/**
 * Names and emails for a doctor's own patients, via the
 * public.doctor_patient_profiles function (20261124110000-doctor-patient-names.sql).
 * Returns only patients with a care relationship to the signed-in, verified
 * doctor; anything else (or an error) yields an empty list.
 */
export const fetchPatientContacts = async (patientIds: string[]): Promise<PatientContact[]> => {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("doctor_patient_profiles", { _patient_ids: ids });
  if (error) {
    console.error("Could not load patient names:", error.message);
    return [];
  }
  return data ?? [];
};
