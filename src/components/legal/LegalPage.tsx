import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/** Highlighted placeholder for a fact the business still has to confirm. */
export const Gap = ({ label }: { label: string }) => (
  <mark className="rounded bg-yellow-100 px-1 py-0.5 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-200">
    [To confirm: {label}]
  </mark>
);

/** Renders a config value, or a Gap when it hasn't been filled in. */
export const Fact = ({ value, label }: { value: string | null; label: string }) =>
  value && value.trim() ? <>{value}</> : <Gap label={label} />;

export const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-28 space-y-3">
    <h2 className="text-xl sm:text-2xl font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
      {children}
    </div>
  </section>
);

export const List = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-medical-blue">{children}</ul>
);

export interface LegalSection {
  id: string;
  title: string;
}

interface LegalPageProps {
  /** Page heading, e.g. "Privacy Policy". */
  title: string;
  lastUpdated: string;
  intro: React.ReactNode;
  /** Number of facts still to confirm; shows a draft notice when > 0. */
  gaps: number;
  /** Table of contents, in page order. Each id must match a <Section id>. */
  sections: LegalSection[];
  /** Optional callout shown above the content (e.g. an emergency notice). */
  callout?: React.ReactNode;
  children: React.ReactNode;
}

/** Shared layout for legal pages: header, hero, draft notice, contents and footer. */
const LegalPage = ({ title, lastUpdated, intro, gaps, sections, callout, children }: LegalPageProps) => {
  const { hash } = useLocation();

  // Arriving via a link (e.g. "/privacy#cookies" from the footer): go to that
  // section, otherwise start at the top rather than the previous scroll position.
  useEffect(() => {
    const el = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (el) el.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [hash]);

  useEffect(() => {
    document.title = `${title} | Clinithetics`;
    return () => {
      document.title = "Clinithetics";
    };
  }, [title]);

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
            <h1 className="text-3xl sm:text-5xl font-bold text-medical-dark mb-3">{title}</h1>
            <p className="text-medical-gray">Last updated: {lastUpdated}</p>
            <div className="mt-4 max-w-3xl text-lg text-medical-gray">{intro}</div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 sm:py-14">
          {gaps > 0 && (
            <div
              role="note"
              className="mb-6 flex gap-3 rounded-lg border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 p-4 text-sm text-yellow-900 dark:text-yellow-200"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>
                <strong>Draft.</strong> {gaps} detail{gaps === 1 ? " is" : "s are"} still being confirmed and
                {gaps === 1 ? " is" : " are"} marked below. This document is under legal review.
              </p>
            </div>
          )}
          {callout && <div className="mb-10">{callout}</div>}
          {!callout && gaps > 0 && <div className="mb-4" />}

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

            <article className="max-w-3xl space-y-10">{children}</article>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LegalPage;
