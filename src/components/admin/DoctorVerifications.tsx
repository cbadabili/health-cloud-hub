import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Check, ExternalLink, FileText, Loader2, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  COUNCILS,
  STATUS_LABELS,
  certificateFileName,
  isCertificateRequired,
  isVerificationTableMissing,
  openCertificate,
  type DoctorVerification,
  type VerificationStatus,
} from "@/lib/doctorVerification";

interface DoctorProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

type Row = DoctorVerification & { profile?: DoctorProfile };
type Filter = VerificationStatus | "all";

const FILTERS: Filter[] = ["pending", "not_submitted", "approved", "rejected", "all"];

const STATUS_STYLES: Record<VerificationStatus, string> = {
  pending: "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300",
  not_submitted: "bg-muted text-muted-foreground",
  approved: "bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300",
  rejected: "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300",
};

const DoctorVerifications = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("doctor_verifications")
      .select("*")
      .order("submitted_at", { ascending: true, nullsFirst: false });

    if (error) {
      if (isVerificationTableMissing(error)) {
        setNotSetUp(true);
        setLoading(false);
        return;
      }
      toast.error("Could not load doctor verifications.");
      setLoading(false);
      return;
    }

    const ids = (data ?? []).map((v) => v.doctor_id);
    let profiles: DoctorProfile[] = [];
    if (ids.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", ids);
      profiles = profileData ?? [];
    }

    setRows((data ?? []).map((v) => ({ ...v, profile: profiles.find((p) => p.user_id === v.doctor_id) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, pending: 0, not_submitted: 0, approved: 0, rejected: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const decide = async (row: Row, status: "approved" | "rejected", rejectionReason?: string) => {
    setBusy(row.doctor_id);
    const { error } = await supabase
      .from("doctor_verifications")
      .update({ status, rejection_reason: status === "rejected" ? rejectionReason ?? null : null })
      .eq("doctor_id", row.doctor_id);
    setBusy(null);

    if (error) {
      toast.error("Could not save the decision. Please try again.");
      return;
    }
    toast.success(status === "approved" ? "Doctor approved." : "Verification rejected.");
    setRejecting(null);
    setReason("");
    load();
  };

  const viewCertificate = async (path: string) => {
    if (!(await openCertificate(path))) toast.error("Could not open the certificate.");
  };

  const name = (row: Row) =>
    [row.profile?.first_name, row.profile?.last_name].filter(Boolean).join(" ") || "Unnamed doctor";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Doctor Verification
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Doctors can't see any patient data until you approve them here. Check each registration
          number with the council before approving.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f === "all" ? "All" : STATUS_LABELS[f]}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[f]}</span>
            </Button>
          ))}
        </div>

        {notSetUp ? (
          <div role="status" className="rounded-lg border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 p-4 text-sm text-yellow-800 dark:text-yellow-300">
            Doctor verification isn't switched on yet. Run the migration{" "}
            <code className="font-mono">20261123200000-doctor-verification.sql</code> in the Supabase SQL
            editor, then reload this page.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {filter === "pending" ? "No doctors are waiting for review." : "No doctors in this list."}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((row) => {
              const council = row.council ? COUNCILS[row.council] : null;
              const isBusy = busy === row.doctor_id;
              return (
                <div key={row.doctor_id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{name(row)}</p>
                      <p className="text-sm text-muted-foreground break-all">{row.profile?.email}</p>
                    </div>
                    <Badge className={`w-fit border-0 ${STATUS_STYLES[row.status]}`}>{STATUS_LABELS[row.status]}</Badge>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Council</dt>
                      <dd className="text-foreground">{council ? `${council.label} (${council.country})` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Registration no.</dt>
                      <dd className="font-mono text-foreground break-all">{row.registration_number ?? "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Certificate</dt>
                      <dd>
                        {row.certificate_path ? (
                          <button
                            type="button"
                            onClick={() => viewCertificate(row.certificate_path!)}
                            className="inline-flex max-w-full items-center gap-1 text-primary underline-offset-4 hover:underline"
                            title={certificateFileName(row.certificate_path)}
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">View</span>
                            <span className="sr-only">certificate for {name(row)}</span>
                          </button>
                        ) : isCertificateRequired(row.council) ? (
                          <span className="inline-flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Missing (required)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not uploaded</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Submitted</dt>
                      <dd className="text-foreground">
                        {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : "—"}
                      </dd>
                    </div>
                  </dl>

                  {row.status === "rejected" && row.rejection_reason && (
                    <p className="text-sm text-red-700 dark:text-red-300">Reason: {row.rejection_reason}</p>
                  )}

                  {council && row.status === "pending" && (
                    <p className="text-xs text-muted-foreground">
                      {council.checkHint}{" "}
                      <a
                        href={council.checkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                      >
                        Open {council.label} site <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  )}

                  {rejecting === row.doctor_id ? (
                    <div className="space-y-2">
                      <label htmlFor={`reason-${row.doctor_id}`} className="text-sm font-medium text-foreground">
                        Reason (shown to the doctor)
                      </label>
                      <Textarea
                        id={`reason-${row.doctor_id}`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Registration number not found on the HPCSA register"
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isBusy || reason.trim().length === 0}
                          onClick={() => decide(row, "rejected", reason.trim())}
                        >
                          Confirm rejection
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRejecting(null); setReason(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {row.status === "pending" && (
                        <>
                          <Button size="sm" disabled={isBusy} onClick={() => decide(row, "approved")}>
                            <Check className="h-4 w-4 mr-1.5" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setRejecting(row.doctor_id)}>
                            <X className="h-4 w-4 mr-1.5" />
                            Reject
                          </Button>
                        </>
                      )}
                      {row.status === "approved" && (
                        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setRejecting(row.doctor_id)}>
                          Revoke approval
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DoctorVerifications;
