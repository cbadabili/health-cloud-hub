/**
 * Facts the privacy policy depends on that only the business can confirm.
 *
 * Anything set to `null` is shown on /privacy as a highlighted
 * "To confirm" marker, and the page shows a draft notice until every value is
 * filled in. Have these reviewed by a lawyer before relying on the policy.
 * See docs/compliance/REGULATORY_READINESS.md for context.
 *
 * Company name, registration number, address and contact email are shared
 * with the Terms of Service: set them in ./companyConfig.ts.
 */
import { isMissing } from "@/lib/legal";
import { companyConfig } from "./companyConfig";

export const privacyPolicyConfig = {
  /** Shown as "Last updated". Change whenever the policy text changes. */
  lastUpdated: "23 November 2026",

  /** Shared company details (edit in ./companyConfig.ts). */
  companyLegalName: companyConfig.legalName,
  companyRegistrationNumber: companyConfig.registrationNumber,
  companyAddress: companyConfig.address,

  /** Where people send privacy questions and requests. */
  privacyEmail: companyConfig.contactEmail,

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
  return values.filter(isMissing).length;
};
