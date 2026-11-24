import { Link } from "react-router-dom";
import { Siren } from "lucide-react";
import LegalPage, { Fact, List, Section } from "@/components/legal/LegalPage";
import { companyConfig as company } from "@/content/companyConfig";
import { countTermsGaps, termsConfig as cfg } from "@/content/termsConfig";

const sections = [
  { id: "about", title: "About these terms" },
  { id: "not-for-emergencies", title: "Not for emergencies" },
  { id: "medical-care", title: "Your care is between you and your doctor" },
  { id: "accounts", title: "Your account" },
  { id: "doctors-and-practices", title: "Doctors and practices" },
  { id: "plans-and-payment", title: "Plans, free trial and payment" },
  { id: "cancelling", title: "Cancelling and closing an account" },
  { id: "acceptable-use", title: "Using Clinithetics responsibly" },
  { id: "your-data", title: "Your information" },
  { id: "the-service", title: "How the service works" },
  { id: "our-property", title: "Our software and brand" },
  { id: "suspension", title: "Suspending or ending access" },
  { id: "liability", title: "Responsibility and liability" },
  { id: "changes", title: "Changes to these terms" },
  { id: "law-and-disputes", title: "Governing law and disputes" },
  { id: "contact", title: "Contact us" },
];

const EmergencyNotice = () => (
  <div
    role="note"
    aria-label="Not for emergencies"
    className="flex gap-3 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-red-800 dark:text-red-200"
  >
    <Siren className="h-5 w-5 shrink-0 mt-0.5" />
    <p className="text-sm sm:text-base">
      <strong>Clinithetics is not an emergency service.</strong> If you or someone else needs urgent medical
      help, call your local emergency number or go to the nearest emergency unit. Don't use bookings, messages or
      telehealth for emergencies.
    </p>
  </div>
);

const TermsOfService = () => {
  const name = company.legalName ?? "Clinithetics";

  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated={cfg.lastUpdated}
      gaps={countTermsGaps()}
      sections={sections}
      callout={<EmergencyNotice />}
      intro={
        <p>
          These terms set out the agreement between you and Clinithetics when you use our platform, whether you're
          a patient, a doctor or a practice. We've kept them as plain as we can. Please read them together with
          our <Link to="/privacy" className="text-medical-blue underline-offset-4 hover:underline">Privacy Policy</Link>.
        </p>
      }
    >
      <Section id="about" title="About these terms">
        <p>
          Clinithetics is operated by{" "}
          <strong>
            <Fact value={company.legalName} label="company legal name" />
          </strong>{" "}
          (registration number <Fact value={company.registrationNumber} label="registration number" />),{" "}
          <Fact value={company.address} label="physical address" />. "We", "us" and "our" mean {name}. "You" means
          the person using Clinithetics, and, where you use it for a practice, that practice too.
        </p>
        <p>
          By creating an account or using Clinithetics, you agree to these terms. If you're using it on behalf of a
          practice, you confirm you're authorised to accept them for that practice.
        </p>
        <p>
          Nothing in these terms takes away rights you have under South Africa's Consumer Protection Act, Botswana's
          consumer protection laws, or any other law that can't be excluded by agreement.
        </p>
      </Section>

      <Section id="not-for-emergencies" title="Not for emergencies">
        <p>
          Clinithetics helps you book appointments, keep records and have video consultations. It is{" "}
          <strong>not</strong> an emergency service, and messages, bookings and records may not be seen straight
          away. In an emergency, call your local emergency number or go to the nearest emergency unit.
        </p>
      </Section>

      <Section id="medical-care" title="Your care is between you and your doctor">
        <List>
          <li>
            We provide software. <strong>We don't give medical advice, diagnose or treat anyone.</strong> Medical
            advice, diagnoses, prescriptions and treatment come from the healthcare professionals who use
            Clinithetics, and they are responsible for them.
          </li>
          <li>
            Telehealth isn't suitable for every condition. Your doctor decides whether a video consultation is
            appropriate, and may ask you to come in person.
          </li>
          <li>Fees for your consultations and treatment are between you and your practice.</li>
        </List>
      </Section>

      <Section id="accounts" title="Your account">
        <List>
          <li>Give us accurate information, and keep it up to date.</li>
          <li>
            Keep your sign-in details private. Don't share your account, and tell us straight away if you think
            someone else has accessed it.
          </li>
          <li>You're responsible for what happens under your account, unless it's caused by our fault.</li>
          <li>
            A parent or legal guardian must create and manage the account of a patient under 18, and accepts these
            terms on the child's behalf.
          </li>
        </List>
      </Section>

      <Section id="doctors-and-practices" title="Doctors and practices">
        <p>If you use Clinithetics as a healthcare professional or practice, you also agree that:</p>
        <List>
          <li>
            You're registered with your health professions council (the HPCSA in South Africa or the BHPC in
            Botswana), you'll keep that registration current, and you'll tell us straight away if it's suspended,
            restricted or ends.
          </li>
          <li>
            We check registration before a doctor can see patient information. That check confirms registration
            only. It isn't an endorsement of anyone's skills or services, and we may suspend access if a
            registration can't be confirmed.
          </li>
          <li>
            You'll follow the law and your professional rules, including on confidentiality, consent, record keeping,
            prescribing and telehealth.
          </li>
          <li>
            For your patients' records, your practice is the "responsible party" (POPIA) or "data controller"
            (DPA), and we process that information on your behalf. You're responsible for having a lawful basis to
            collect and use it, and for telling your patients how you use it. Our data processing (operator) terms
            are: <Fact value={cfg.operatorAgreement} label="where practices find the data processing agreement" />.
          </li>
        </List>
      </Section>

      <Section id="plans-and-payment" title="Plans, free trial and payment">
        <List>
          <li>
            Practices choose a monthly plan. Current plans and prices are shown in South African Rand on our{" "}
            <Link to="/#pricing">pricing section</Link>. <Fact value={cfg.vat} label="whether prices include VAT" />
          </li>
          <li>
            New practices get a <strong>30-day free trial</strong>. No credit card is needed to start it, and there
            are no setup fees. When the trial ends, <Fact value={cfg.afterTrial} label="what happens when the trial ends" />.
          </li>
          <li>
            Billing: <Fact value={cfg.billing} label="how and when practices are billed" />.
          </li>
          <li>
            We'll give you at least <Fact value={cfg.priceChangeNotice} label="notice period for price changes" />{" "}
            notice before a price change affects you, and you can cancel before it takes effect.
          </li>
          <li>
            Features differ by plan and may change as we develop Clinithetics. We won't remove a core feature you're
            paying for without telling you first.
          </li>
          <li>There's currently no charge for patients to use Clinithetics.</li>
        </List>
      </Section>

      <Section id="cancelling" title="Cancelling and closing an account">
        <List>
          <li>
            Practices can cancel at any time. Cancellation takes effect{" "}
            <Fact value={cfg.cancellationEffect} label="when cancellation takes effect, and refunds" />.
          </li>
          <li>
            After a practice leaves, its data is{" "}
            <Fact value={cfg.dataAfterCancellation} label="what happens to a practice's data after it leaves" />.
          </li>
          <li>
            Patients can ask us to close their account at any time. Some health records may have to be kept for a
            period the law requires; our <Link to="/privacy#retention">Privacy Policy</Link> explains this.
          </li>
        </List>
      </Section>

      <Section id="acceptable-use" title="Using Clinithetics responsibly">
        <p>Don't use Clinithetics to:</p>
        <List>
          <li>break the law, or help anyone else to;</li>
          <li>access, or try to access, information you're not entitled to see, including other people's records;</li>
          <li>pretend to be someone else, or give false registration details;</li>
          <li>get around our security or access controls, or test them without our written permission;</li>
          <li>upload viruses or other harmful code, or overload or disrupt the service;</li>
          <li>copy, scrape or resell the service or the information in it.</li>
        </List>
      </Section>

      <Section id="your-data" title="Your information">
        <p>
          You, or your practice, keep ownership of the information you put into Clinithetics. You give us permission
          to store, process and display it only as needed to run the service for you and as our{" "}
          <Link to="/privacy">Privacy Policy</Link> describes. We don't sell it or use it for advertising.
        </p>
      </Section>

      <Section id="the-service" title="How the service works">
        <List>
          <li>
            We work to keep Clinithetics available and secure, but we can't promise it will always be uninterrupted
            or error-free. We may need to carry out maintenance, and we'll try to do it at quiet times.
          </li>
          <li>Clinithetics relies on internet access and on service providers such as our hosting providers.</li>
          <li>We may improve or change the service over time.</li>
        </List>
      </Section>

      <Section id="our-property" title="Our software and brand">
        <p>
          The Clinithetics software, design and brand belong to us or our licensors. We give you a personal,
          non-transferable right to use Clinithetics while these terms apply. You may not copy, modify or reverse
          engineer it, except where the law allows.
        </p>
      </Section>

      <Section id="suspension" title="Suspending or ending access">
        <p>We may suspend or close an account, with notice where reasonable, if:</p>
        <List>
          <li>you seriously or repeatedly break these terms;</li>
          <li>a doctor's registration can't be confirmed, or is suspended or ends;</li>
          <li>we need to, to protect patients, other users, or the security of the service;</li>
          <li>a practice doesn't pay fees that are due, after we've reminded it;</li>
          <li>the law requires us to.</li>
        </List>
      </Section>

      <Section id="liability" title="Responsibility and liability">
        <List>
          <li>
            We're responsible for losses caused by our own failure to meet these terms or by our negligence. We're
            not responsible for medical advice, diagnoses or treatment given by healthcare professionals using
            Clinithetics, or for losses we couldn't reasonably have foreseen or prevented.
          </li>
          <li>
            To the extent the law allows, our total liability to a practice under these terms is limited to{" "}
            <Fact value={cfg.liabilityCap} label="liability cap" />.
          </li>
          <li>
            Nothing in these terms limits liability that can't be limited by law, including for gross negligence or
            intentional wrongdoing, or your rights under consumer protection law.
          </li>
        </List>
      </Section>

      <Section id="changes" title="Changes to these terms">
        <p>
          We may update these terms as Clinithetics or the law changes. For changes that materially affect you,
          we'll give you at least <Fact value={cfg.termsChangeNotice} label="notice period for changes to these terms" />{" "}
          notice by email or in the app. If you don't agree, you can stop using Clinithetics and cancel before the
          change takes effect. We'll update the "Last updated" date above.
        </p>
      </Section>

      <Section id="law-and-disputes" title="Governing law and disputes">
        <p>
          These terms are governed by <Fact value={cfg.governingLaw} label="governing law" />. If there's a
          problem, please contact us first so we can try to resolve it. If we can't, disputes will be heard by{" "}
          <Fact value={cfg.disputeForum} label="courts or other forum for disputes" />. If you're a consumer, you
          may also have the right to approach a consumer ombud or regulator in your country.
        </p>
      </Section>

      <Section id="contact" title="Contact us">
        <p>
          Questions about these terms:{" "}
          {company.contactEmail ? (
            <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>
          ) : (
            <Fact value={null} label="contact email" />
          )}
          .
        </p>
      </Section>
    </LegalPage>
  );
};

export default TermsOfService;
