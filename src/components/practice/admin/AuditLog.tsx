import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePractice } from "@/hooks/usePractice";
import { formatDateTime } from "@/lib/locale";

type AuditEvent = Database["public"]["Tables"]["audit_events"]["Row"];

const PAGE = 50;

const TABLE_LABELS: Record<string, string> = {
  patients: "Patient",
  patient_contacts: "Patient contact",
  patient_portal_links: "Portal access",
  staff_memberships: "Staff role",
  staff_invitations: "Invitation",
  appointments: "Appointment",
  medical_records: "Clinical note",
  prescriptions: "Prescription",
  invoices: "Invoice",
  practices: "Practice settings",
  sites: "Site",
  rooms: "Room",
};

/** Readable action, e.g. "Patient updated" or "Patient record opened". */
const describe = (e: AuditEvent) => {
  if (e.action === "patients.view") return "Patient record opened";
  if (e.action === "patients.merge") return "Patient records merged";
  if (e.action === "patients.registered_despite_duplicates") return "Patient registered despite possible duplicates";
  const [, verb] = e.action.split(".");
  const thing = TABLE_LABELS[e.target_table ?? ""] ?? e.target_table ?? "Record";
  const v = { insert: "created", update: "updated", delete: "deleted" }[verb?.toLowerCase() ?? ""] ?? verb ?? e.action;
  return `${thing} ${v}`;
};

/** Who did what, when (owners and managers). Never shows record contents. */
const AuditLog = () => {
  const { current } = usePractice();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  const load = useCallback(
    async (before?: number) => {
      if (!current) return;
      setLoading(true);
      let q = supabase.from("audit_events").select("*").eq("practice_id", current.practice_id).order("id", { ascending: false }).limit(PAGE);
      if (before) q = q.lt("id", before);
      const { data } = await q;
      setEvents((prev) => (before ? [...prev, ...(data ?? [])] : data ?? []));
      setMore((data ?? []).length === PAGE);
      setLoading(false);
    },
    [current],
  );

  useEffect(() => {
    if (!current) return;
    load();
    supabase.rpc("practice_staff_directory", { _practice_id: current.practice_id }).then(({ data }) => {
      const m = new Map<string, string>();
      for (const s of data ?? []) m.set(s.user_id, [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email || "Staff member");
      setNames(m);
    });
  }, [current, load]);

  const tz = current?.timezone ?? "Africa/Gaborone";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>
          Every change to patients, staff, appointments, notes and invoices, and every time a patient record is opened. Entries
          can't be edited or deleted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 && !loading ? (
          <p className="py-8 text-center text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{describe(e)}</p>
                  <p className="text-muted-foreground">
                    {e.actor_user_id ? names.get(e.actor_user_id) ?? "Former or outside user" : "System"}
                    {e.outcome !== "success" && ` · ${e.outcome}`}
                  </p>
                </div>
                <time className="shrink-0 text-muted-foreground" dateTime={e.occurred_at}>
                  {formatDateTime(e.occurred_at, tz)}
                </time>
              </li>
            ))}
          </ul>
        )}
        {loading && (
          <div className="flex justify-center py-4" aria-busy="true">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {more && !loading && (
          <Button variant="outline" onClick={() => load(events[events.length - 1]?.id)}>
            Load older entries
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLog;
