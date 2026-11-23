import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, ExternalLink, LogOut, RefreshCw, ShieldAlert, ShieldCheck, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";
import CertificatePicker from "@/components/doctor/CertificatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  CERTIFICATE_BUCKET,
  COUNCILS,
  buildCertificatePath,
  certificateFileName,
  isCertificateRequired,
  isValidRegistrationNumber,
  openCertificate,
  type DoctorVerification,
  type RegistrationCouncil,
} from "@/lib/doctorVerification";

interface DoctorVerificationGateProps {
  verification: DoctorVerification | null;
  onChange: () => void;
}

const CERTIFICATE_HINT =
  "Upload your certificate of registration or a current certificate of good standing.";

/**
 * Shown to doctors whose registration has not been approved yet.
 * Access to patient data is enforced by database policies; this screen
 * explains the state and lets the doctor submit or correct their details.
 */
const DoctorVerificationGate = ({ verification, onChange }: DoctorVerificationGateProps) => {
  const { user, signOut } = useAuth();
  const [council, setCouncil] = useState<RegistrationCouncil | "">(verification?.council ?? "");
  const [number, setNumber] = useState(verification?.registration_number ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const status = verification?.status ?? "not_submitted";
  const isPending = status === "pending";
  const isRejected = status === "rejected";
  const existingPath = verification?.certificate_path ?? null;

  /** Uploads the chosen file to the doctor's private folder and returns its path. */
  const uploadCertificate = async (selected: File): Promise<string | null> => {
    if (!user) return null;
    const path = buildCertificatePath(user.id, selected);
    const { error } = await supabase.storage
      .from(CERTIFICATE_BUCKET)
      .upload(path, selected, { contentType: selected.type, upsert: false });
    if (error) {
      toast.error("Could not upload your certificate. Please try again.");
      return null;
    }
    return path;
  };

  /** Removes a file that is no longer referenced (best effort). */
  const removeFile = async (path: string | null) => {
    if (path) await supabase.storage.from(CERTIFICATE_BUCKET).remove([path]);
  };

  /** Saves details (and optionally a new certificate) to doctor_verifications. */
  const save = async (details: { council?: RegistrationCouncil; registration_number?: string }, newFile: File | null) => {
    if (!user) return false;
    setSaving(true);

    let certificate_path = existingPath;
    if (newFile) {
      const uploaded = await uploadCertificate(newFile);
      if (!uploaded) {
        setSaving(false);
        return false;
      }
      certificate_path = uploaded;
    }

    // The database sets the status to "pending"; doctors cannot approve themselves.
    // certificate_path is only sent when a new file was uploaded.
    const row = newFile ? { ...details, certificate_path } : details;
    const { error } = verification
      ? await supabase.from("doctor_verifications").update(row).eq("doctor_id", user.id)
      : await supabase.from("doctor_verifications").insert({ doctor_id: user.id, ...row });

    if (error) {
      if (newFile) await removeFile(certificate_path);
      setSaving(false);
      toast.error("Could not save your details. Please try again.");
      return false;
    }

    // Replaced an older certificate: tidy up the previous file.
    if (newFile && existingPath && existingPath !== certificate_path) await removeFile(existingPath);

    setSaving(false);
    setFile(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!council) {
      toast.error("Please choose the council you are registered with.");
      return;
    }
    if (!isValidRegistrationNumber(number)) {
      toast.error("Please enter your registration number (3 to 40 characters).");
      return;
    }
    if (isCertificateRequired(council) && !file && !existingPath) {
      toast.error(`Please upload your certificate. ${COUNCILS[council].label} registrations can't be checked online.`);
      return;
    }
    if (await save({ council, registration_number: number.trim() }, file)) {
      toast.success("Thanks. Your registration has been sent for review.");
      onChange();
    }
  };

  const handleCertificateOnly = async () => {
    if (!file) return;
    if (await save({}, file)) {
      toast.success("Certificate uploaded.");
      onChange();
    }
  };

  const viewCertificate = async () => {
    if (existingPath && !(await openCertificate(existingPath))) {
      toast.error("Could not open the certificate. Please try again.");
    }
  };

  const existingCertificate = () =>
    existingPath ? (
      <button
        type="button"
        onClick={viewCertificate}
        className="inline-flex max-w-full items-center gap-1 text-primary underline-offset-4 hover:underline"
      >
        <span className="truncate">{certificateFileName(existingPath)}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </button>
    ) : (
      <span className="text-muted-foreground">Not uploaded</span>
    );

  const missingRequiredCertificate = isCertificateRequired(verification?.council) && !existingPath;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0" aria-label="Go to home page">
            <div className="p-2 bg-gradient-primary rounded-lg shrink-0">
              <Stethoscope className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground truncate">Clinithetics</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex justify-center p-4 sm:p-8">
        <Card className="w-full max-w-lg shadow-card">
          {isPending ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 p-3 rounded-full bg-yellow-100 dark:bg-yellow-500/15">
                  <Clock className="h-6 w-6 text-yellow-700 dark:text-yellow-300" />
                </div>
                <CardTitle>Your registration is being reviewed</CardTitle>
                <CardDescription>
                  We check every doctor with their health professions council before giving access to
                  patient data. Your dashboard will open here once you're approved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {missingRequiredCertificate && (
                  <div
                    role="alert"
                    className="flex gap-2 rounded-lg border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-300"
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Please upload your certificate below. BHPC registrations can't be checked online, so we
                      can't approve you without it.
                    </span>
                  </div>
                )}

                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 rounded-lg border border-border p-4 text-sm">
                  <dt className="text-muted-foreground">Council</dt>
                  <dd className="font-medium text-foreground">
                    {verification?.council
                      ? `${COUNCILS[verification.council].label} (${COUNCILS[verification.council].country})`
                      : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Registration no.</dt>
                  <dd className="font-medium text-foreground break-all">{verification?.registration_number}</dd>
                  <dt className="text-muted-foreground">Certificate</dt>
                  <dd className="min-w-0">
                    {existingCertificate()}
                  </dd>
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd className="text-foreground">
                    {verification?.submitted_at
                      ? new Date(verification.submitted_at).toLocaleDateString()
                      : "—"}
                  </dd>
                </dl>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <CertificatePicker
                    file={file}
                    onChange={setFile}
                    required={isCertificateRequired(verification?.council)}
                    label={existingPath ? "Replace certificate" : "Add your certificate"}
                    hint={CERTIFICATE_HINT}
                  />
                  {file && (
                    <Button className="w-full" variant="hero" onClick={handleCertificateOnly} disabled={saving}>
                      {saving ? "Uploading..." : "Upload certificate"}
                    </Button>
                  )}
                </div>

                <Button variant="outline" className="w-full" onClick={onChange}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check again
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 p-3 rounded-full bg-medical-light-blue">
                  {isRejected ? (
                    <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
                  ) : (
                    <ShieldCheck className="h-6 w-6 text-medical-blue" />
                  )}
                </div>
                <CardTitle>{isRejected ? "We couldn't verify your registration" : "Verify your registration"}</CardTitle>
                <CardDescription>
                  {isRejected
                    ? "Please check your details and submit them again."
                    : "Before you can see patients, we need to confirm you're registered with a health professions council."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isRejected && verification?.rejection_reason && (
                  <div
                    role="alert"
                    className="mb-4 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
                  >
                    <span className="font-medium">Reason: </span>
                    {verification.rejection_reason}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gate-council">Registered with</Label>
                    <select
                      id="gate-council"
                      required
                      value={council}
                      onChange={(e) => setCouncil(e.target.value as RegistrationCouncil)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="" disabled>
                        Choose a council
                      </option>
                      {(Object.keys(COUNCILS) as RegistrationCouncil[]).map((code) => (
                        <option key={code} value={code}>
                          {COUNCILS[code].label} ({COUNCILS[code].country})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gate-number">Registration number</Label>
                    <Input
                      id="gate-number"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder={council ? COUNCILS[council].numberHint : "Your practitioner registration number"}
                      required
                      minLength={3}
                      maxLength={40}
                    />
                  </div>

                  {existingPath && !file && (
                    <p className="text-sm text-muted-foreground">
                      Current certificate: {existingCertificate()}
                    </p>
                  )}
                  <CertificatePicker
                    file={file}
                    onChange={setFile}
                    required={isCertificateRequired(council) && !existingPath}
                    label={existingPath ? "Replace certificate" : "Registration certificate"}
                    hint={
                      isCertificateRequired(council)
                        ? `${CERTIFICATE_HINT} BHPC registrations can't be checked online, so this is required.`
                        : CERTIFICATE_HINT
                    }
                  />

                  <Button type="submit" variant="hero" className="w-full" disabled={saving}>
                    {saving ? "Submitting..." : "Submit for review"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
};

export default DoctorVerificationGate;
