/**
 * Business decisions the Terms of Service depend on.
 *
 * Anything set to `null` is shown on /terms as a highlighted "To confirm"
 * marker, and the page shows a draft notice until every value is filled in.
 * Company name, registration number, address and contact email come from
 * ./companyConfig.ts. Have the terms reviewed by a lawyer before relying on them.
 */
import { isMissing } from "@/lib/legal";
import { companyConfig } from "./companyConfig";

export const termsConfig = {
  /** Shown as "Last updated". Change whenever the terms change. */
  lastUpdated: "24 November 2026",

  // --- Plans and payment (practices) ------------------------------------------
  /** e.g. "Prices exclude VAT, which is added at the applicable rate." */
  vat: null as string | null,
  /** How and when practices are billed, e.g. "monthly in advance by debit order or card". */
  billing: null as string | null,
  /** What happens when the free trial ends, e.g. "your account pauses until you choose a plan". */
  afterTrial: null as string | null,
  /** Notice before price changes, e.g. "30 days". */
  priceChangeNotice: null as string | null,

  // --- Cancellation ---------------------------------------------------------------
  /** When a cancellation takes effect and whether there are refunds, e.g. "at the end of the current billing month; we don't refund partial months". */
  cancellationEffect: null as string | null,
  /** What happens to a practice's data after it leaves, e.g. "available to export for 30 days, then deleted or returned, subject to legal retention periods". */
  dataAfterCancellation: null as string | null,

  // --- Practices as responsible parties --------------------------------------------
  /** Where the data processing (operator) agreement for practices can be found, e.g. a URL or "sent to you on sign-up". */
  operatorAgreement: null as string | null,

  // --- Liability and disputes ---------------------------------------------------------
  /** Liability cap, e.g. "the fees you paid us in the 12 months before the claim". */
  liabilityCap: null as string | null,
  /** Notice before material changes to these terms, e.g. "30 days". */
  termsChangeNotice: null as string | null,
  /** e.g. "the laws of the Republic of South Africa". */
  governingLaw: null as string | null,
  /** e.g. "the courts of South Africa, Western Cape Division". */
  disputeForum: null as string | null,
};

/** Number of facts still to confirm, including shared company details (drives the draft notice). */
export const countTermsGaps = () => {
  const { lastUpdated: _ignored, ...decisions } = termsConfig;
  const values = [
    companyConfig.legalName,
    companyConfig.registrationNumber,
    companyConfig.address,
    companyConfig.contactEmail,
    ...Object.values(decisions),
  ];
  return values.filter(isMissing).length;
};
