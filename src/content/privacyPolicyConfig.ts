/**
 * Facts the privacy policy depends on that only the business can confirm.
 *
 * Anything set to `null` is shown on /privacy as a highlighted
 * "To confirm" marker, and the page shows a draft notice until every value is
 * filled in. Have these reviewed by a lawyer before relying on the policy.
 * See docs/compliance/REGULATORY_READINESS.md for context.
 */
export const privacyPolicyConfig = {
  /** Shown as "Last updated". Change whenever the policy text changes. */
  lastUpdated: "23 November 2026",

  /** Registered legal name, e.g. "Clinithetics (Pty) Ltd". */
  companyLegalName: null as string | null,
  /** Company registration number (CIPC in South Africa / CIPA in Botswana). */
  companyRegistrationNumber: null as string | null,
  /** Full physical address for legal notices. */
  companyAddress: null as string | null,

  /** Where people send privacy questions and requests. Already listed in the site footer. */
  privacyEmail: "support@clinithetics.com" as string | null,

  /** POPIA Information Officer (South Africa): name and email. Must also be registered with the Information Regulator. */
  informationOfficer: null as string | null,
  /** Data Protection Officer for Botswana (DPA 2024): name and email. */
  botswanaDataProtectionOfficer: null as string | null,

  /** Where data is stored, e.g. "Supabase (AWS eu-west-2, London) and Vercel (global edge network)". */
  hostingLocations: null as string | null,

  /** How long each kind of information is kept. */
  retention: {
    accounts: null as string | null,
    clinicalRecords: null as string | null,
    doctorCertificates: null as string | null,
    billing: null as string | null,
  },

  /** Contact details for Botswana's Information and Data Protection Commission (no official channel confirmed yet). */
  botswanaRegulatorContact: null as string | null,
};

/** Number of facts still to confirm (drives the draft notice). */
export const countPrivacyGaps = () => {
  const c = privacyPolicyConfig;
  const values = [
    c.companyLegalName,
    c.companyRegistrationNumber,
    c.companyAddress,
    c.privacyEmail,
    c.informationOfficer,
    c.botswanaDataProtectionOfficer,
    c.hostingLocations,
    c.botswanaRegulatorContact,
    ...Object.values(c.retention),
  ];
  return values.filter((v) => v === null || v.trim() === "").length;
};
