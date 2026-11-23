import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { countPrivacyGaps, privacyPolicyConfig as cfg } from "@/content/privacyPolicyConfig";

/** Highlighted placeholder for a fact the business still has to confirm. */
const Gap = ({ label }: { label: string }) => (
  <mark className="rounded bg-yellow-100 px-1 py-0.5 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-200">
    [To confirm: {label}]
  </mark>
);

/** Renders a config value, or a Gap when it hasn't been filled in. */
const Fact = ({ value, label }: { value: string | null; label: string }) =>
  value && value.trim() ? <>{value}</> : <Gap label={label} />;

const sections = [
  { id: "who-we-are", title: "Who we are" },
  { id: "our-role", title: "Our role and your practice's role" },
  { id: "information-we-collect", title: "Information we collect" },
  { id: "how-we-use-it", title: "How we use it, and why we're allowed to" },
  { id: "sharing", title: "Who we share it with" },
  { id: "where-stored", title: "Where it's stored" },
  { id: "security", title: "How we protect it" },
  { id: "retention", title: "How long we keep it" },
  { id: "your-rights", title: "Your rights" },
  { id: "cookies", title: "Cookies and browser storage" },
  { id: "children", title: "Children" },
  { id: "breaches", title: "If something goes wrong" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact us and complaints" },
];

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-28 space-y-3">
    <h2 className="text-xl sm:text-2xl font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
      {children}
    </div>
  </section>
);

const List = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-medical-blue">{children}</ul>
);

const PrivacyPolicy = () => {
  const gaps = countPrivacyGaps();
  const company = cfg.companyLegalName ?? "Clinithetics";
  const { hash } = useLocation();

  // Arriving via a link (e.g. "/privacy#cookies" from the footer): go to that
  // section, otherwise start at the top rather than the previous scroll position.
  useEffect(() => {
    const el = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (el) el.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [hash]);

  useEffect(() => {
    document.title = "Privacy Policy | Clinithetics";
    return () => {
      document.title = "Clinithetics";
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <div className="bg-gradient-hero border-b border-border">
          <div className="container mx-auto px-4 py-10 sm:py-14">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-medical-blue mb-6 group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
            <h1 className="text-3xl sm:text-5xl font-bold text-medical-dark mb-3">Privacy Policy</h1>
            <p className="text-medical-gray">Last updated: {cfg.lastUpdated}</p>
            <p className="mt-4 max-w-3xl text-lg text-medical-gray">
              Clinithetics handles health information, which is some of the most sensitive information there
              is. This policy explains, in plain language, what we collect, why, who can see it, and the
              rights you have under South Africa's Protection of Personal Information Act (POPIA) and
              Botswana's Data Protection Act, 2024 (DPA).
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 sm:py-14">
          {gaps > 0 && (
            <div
              role="note"
              className="mb-10 flex gap-3 rounded-lg border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 p-4 text-sm text-yellow-900 dark:text-yellow-200"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>
                <strong>Draft.</strong> {gaps} detail{gaps === 1 ? " is" : "s are"} still being confirmed and
                {gaps === 1 ? " is" : " are"} marked below. This policy is under legal review.
              </p>
            </div>
          )}

          <div className="grid gap-10 lg:grid-cols-[16rem,1fr]">
            <nav aria-label="On this page" className="hidden lg:block">
              <div className="sticky top-28">
                <p className="mb-3 text-sm font-semibold text-foreground">On this page</p>
                <ol className="space-y-2 text-sm">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>

            <article className="max-w-3xl space-y-10">
              <Section id="who-we-are" title="Who we are">
                <p>
                  Clinithetics is a cloud platform for medical practices and their patients: appointment
                  booking, patient records, prescriptions, billing and telehealth. It is operated by{" "}
                  <strong>
                    <Fact value={cfg.companyLegalName} label="company legal name" />
                  </strong>{" "}
                  (registration number <Fact value={cfg.companyRegistrationNumber} label="registration number" />
                  ), <Fact value={cfg.companyAddress} label="physical address" />. In this policy, "we", "us" and
                  "our" mean {company}.
                </p>
                <p>
                  This policy applies to everyone who uses Clinithetics: patients, doctors, practice staff and
                  visitors to our website.
                </p>
              </Section>

              <Section id="our-role" title="Our role and your practice's role">
                <p>
                  When a practice uses Clinithetics to keep its patients' records, <strong>the practice</strong>{" "}
                  decides why and how that health information is used. The practice is the "responsible party"
                  (POPIA) or "data controller" (DPA). We store and process that information{" "}
                  <strong>on the practice's behalf</strong>, as its "operator" or "data processor", and only on
                  its instructions.
                </p>
                <p>
                  For information we hold for our own purposes, such as your account details, doctor
                  verification records and our own billing, <strong>we</strong> are the responsible party.
                </p>
                <p>
                  If you have a question about your medical record, you can ask your practice or contact us, and
                  we'll help you reach the right people.
                </p>
              </Section>

              <Section id="information-we-collect" title="Information we collect">
                <p>
                  <strong>Everyone with an account</strong>
                </p>
                <List>
                  <li>Your name and email address, and if you add them, your phone number, address and profile photo.</li>
                  <li>Your account type (patient, doctor or administrator) and your sign-in details. Passwords are handled by our authentication provider and are never visible to us.</li>
                </List>
                <p>
                  <strong>Patients</strong>
                </p>
                <List>
                  <li>Health details you or your doctor add: date of birth, gender, blood type, medical history, allergies and current medication.</li>
                  <li>Emergency contact name and phone number, and medical aid or insurance provider and policy number.</li>
                  <li>Appointments (date, type, reason for visit, status, notes), consultation notes, diagnoses, treatment plans, vital signs, prescriptions and invoices.</li>
                </List>
                <p>
                  <strong>Doctors</strong>
                </p>
                <List>
                  <li>Professional details: specialisation, qualifications, experience, consultation fee and availability.</li>
                  <li>
                    Your health professions council (HPCSA or BHPC), registration number, and any registration
                    certificate you upload, so we can check you're registered before you can see patient
                    information.
                  </li>
                </List>
                <p>
                  <strong>Technical information</strong>
                </p>
                <List>
                  <li>
                    Our hosting providers keep standard logs (such as IP address, browser type and the time of a
                    request) to run the service securely and investigate problems.
                  </li>
                </List>
                <p>
                  We don't currently store payment card details, and we don't record telehealth video
                  consultations.
                </p>
              </Section>

              <Section id="how-we-use-it" title="How we use it, and why we're allowed to">
                <List>
                  <li>
                    <strong>To provide the service:</strong> creating your account, booking appointments, letting
                    your doctor keep your records and prescriptions, issuing invoices and running telehealth
                    sessions. This is necessary to provide the service you or your practice signed up for.
                  </li>
                  <li>
                    <strong>Health information</strong> is "special personal information" under POPIA and
                    "sensitive data" under the DPA. It is processed for your care by health professionals who are
                    bound by a duty of confidentiality, or with your consent, as those laws allow.
                  </li>
                  <li>
                    <strong>To keep patients safe:</strong> verifying that doctors are registered with their
                    council before they can access patient information.
                  </li>
                  <li>
                    <strong>To keep the service secure and working:</strong> preventing misuse, fixing faults and
                    protecting accounts.
                  </li>
                  <li>
                    <strong>To meet legal obligations,</strong> for example keeping health and financial records
                    for as long as the law requires, or responding to a lawful request.
                  </li>
                </List>
                <p>
                  We don't sell your information, use it for advertising, or use your health information for any
                  purpose other than your care and running the service.
                </p>
              </Section>

              <Section id="sharing" title="Who we share it with">
                <List>
                  <li>
                    <strong>Your healthcare providers:</strong> doctors and practices you book with can see the
                    information they need to care for you. Doctors only get access after their registration has
                    been verified.
                  </li>
                  <li>
                    <strong>Service providers who run Clinithetics for us,</strong> under contracts that require
                    them to protect your information: Supabase (database, sign-in and file storage) and Vercel
                    (website hosting).
                  </li>
                  <li>
                    <strong>Authorities,</strong> only where the law requires it, such as a court order, or to
                    protect someone's life or safety.
                  </li>
                </List>
              </Section>

              <Section id="where-stored" title="Where it's stored">
                <p>
                  Your information is stored with our service providers at:{" "}
                  <Fact value={cfg.hostingLocations} label="hosting regions for Supabase and Vercel" />.
                </p>
                <p>
                  If information is stored or processed outside South Africa or Botswana, we only do so where the
                  law allows it, for example where the other country or the provider gives a level of protection
                  similar to POPIA and the DPA, or under a binding agreement that requires it. Where the law
                  requires a copy of Botswana residents' data to remain in Botswana, or requires prior approval,
                  we will comply.
                </p>
              </Section>

              <Section id="security" title="How we protect it">
                <List>
                  <li>All connections to Clinithetics are encrypted (HTTPS).</li>
                  <li>
                    Access is limited by role at the database level. Patients can only see their own records, and
                    doctors can only see records for their own patients, and only after their registration has
                    been verified.
                  </li>
                  <li>
                    Doctors' registration certificates are kept in private storage. Only the doctor and authorised
                    administrators can open them, through links that expire after one minute.
                  </li>
                  <li>Sign-in sessions end when you close your browser.</li>
                  <li>Only a small number of authorised administrators can manage accounts.</li>
                </List>
                <p>
                  No system is perfectly secure, but we work to protect your information and to improve our
                  safeguards over time.
                </p>
              </Section>

              <Section id="retention" title="How long we keep it">
                <p>We keep information only as long as we need it, or as long as the law requires:</p>
                <List>
                  <li>
                    <strong>Account details:</strong> <Fact value={cfg.retention.accounts} label="retention period for accounts" />
                  </li>
                  <li>
                    <strong>Medical records:</strong>{" "}
                    <Fact value={cfg.retention.clinicalRecords} label="retention period for medical records" />. Health
                    records often have to be kept for a minimum period under health law and professional rules.
                  </li>
                  <li>
                    <strong>Doctor registration certificates:</strong>{" "}
                    <Fact value={cfg.retention.doctorCertificates} label="retention period for certificates" />
                  </li>
                  <li>
                    <strong>Invoices and billing:</strong> <Fact value={cfg.retention.billing} label="retention period for billing" />
                  </li>
                </List>
                <p>When information is no longer needed, we delete it or make it anonymous.</p>
              </Section>

              <Section id="your-rights" title="Your rights">
                <p>Under POPIA and the DPA, you have the right to:</p>
                <List>
                  <li>ask whether we hold information about you, and get a copy of it;</li>
                  <li>ask us to correct information that is wrong or incomplete;</li>
                  <li>ask us to delete information we no longer have a lawful reason to keep;</li>
                  <li>object to how we use your information, in certain circumstances;</li>
                  <li>withdraw consent you've given, without affecting anything done before;</li>
                  <li>complain to the regulator (see "Contact us and complaints" below).</li>
                </List>
                <p>
                  To make a request, email{" "}
                  {cfg.privacyEmail ? <a href={`mailto:${cfg.privacyEmail}`}>{cfg.privacyEmail}</a> : <Gap label="privacy email" />}. We
                  may need to confirm your identity first. We'll respond within the time the law requires. Some
                  health records can't be deleted while the law requires them to be kept, and we'll explain if
                  that applies. For records your practice controls, we'll work with the practice to handle your
                  request.
                </p>
              </Section>

              <Section id="cookies" title="Cookies and browser storage">
                <p>
                  We don't use advertising or tracking cookies, and we don't use third-party analytics. We only
                  store what the site needs to work:
                </p>
                <List>
                  <li>
                    <strong>Your sign-in session,</strong> kept in your browser's session storage and cleared when
                    you close the browser.
                  </li>
                  <li>
                    <strong>Your light or dark mode choice,</strong> kept in your browser's local storage.
                  </li>
                </List>
              </Section>

              <Section id="children" title="Children">
                <p>
                  Clinithetics isn't meant to be used by children on their own. A parent or legal guardian should
                  create and manage the account for a patient under 18, and give any consent the law requires on
                  the child's behalf.
                </p>
              </Section>

              <Section id="breaches" title="If something goes wrong">
                <p>
                  If we believe your personal information has been accessed or obtained without authorisation, we
                  will notify the Information Regulator (South Africa) and/or the Information and Data Protection
                  Commission (Botswana) within the time the law requires, and tell affected people as soon as
                  reasonably possible, with steps you can take to protect yourself.
                </p>
              </Section>

              <Section id="changes" title="Changes to this policy">
                <p>
                  We may update this policy as Clinithetics changes or the law changes. We'll update the "Last
                  updated" date above, and tell you about significant changes by email or in the app.
                </p>
              </Section>

              <Section id="contact" title="Contact us and complaints">
                <List>
                  <li>
                    <strong>Privacy questions and requests:</strong>{" "}
                    {cfg.privacyEmail ? <a href={`mailto:${cfg.privacyEmail}`}>{cfg.privacyEmail}</a> : <Gap label="privacy email" />}
                  </li>
                  <li>
                    <strong>Information Officer (South Africa):</strong>{" "}
                    <Fact value={cfg.informationOfficer} label="Information Officer name and email" />
                  </li>
                  <li>
                    <strong>Data Protection Officer (Botswana):</strong>{" "}
                    <Fact value={cfg.botswanaDataProtectionOfficer} label="Data Protection Officer name and email" />
                  </li>
                </List>
                <p>If you're not happy with how we've handled your information, you can complain to the regulator:</p>
                <List>
                  <li>
                    <strong>South Africa:</strong> the Information Regulator.{" "}
                    <a href="https://inforegulator.org.za/complaints/" target="_blank" rel="noopener noreferrer">
                      How to lodge a complaint <ExternalLink className="inline h-3 w-3 align-baseline" />
                    </a>
                  </li>
                  <li>
                    <strong>Botswana:</strong> the Information and Data Protection Commission.{" "}
                    <Fact value={cfg.botswanaRegulatorContact} label="Commission contact details" />
                  </li>
                </List>
                <p>We'd appreciate the chance to help first, so please contact us before going to the regulator.</p>
              </Section>
            </article>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
