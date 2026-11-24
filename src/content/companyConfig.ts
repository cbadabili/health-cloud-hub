/**
 * Company details used by the legal pages (/privacy and /terms).
 *
 * Fill these in once; both pages read them. Anything left as `null` is shown
 * as a highlighted "To confirm" marker, and the page shows a draft notice.
 */
export const companyConfig = {
  /** Registered legal name, e.g. "Clinithetics (Pty) Ltd". */
  legalName: null as string | null,
  /** Company registration number (CIPC in South Africa / CIPA in Botswana). */
  registrationNumber: null as string | null,
  /** Full physical address for legal notices. */
  address: null as string | null,
  /** General contact email for legal and privacy questions. Already listed in the site footer. */
  contactEmail: "support@clinithetics.com" as string | null,
};
