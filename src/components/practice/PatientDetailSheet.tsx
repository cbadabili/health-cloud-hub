import { useCallback, useEffect, useState } from "react";
import { Calendar, FileText, GitMerge, Link2, Loader2, Pencil, Phone, Plus, Receipt, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePractice } from "@/hooks/usePractice";
import {
  COUNTRIES,
  ID_TYPE_LABELS,
  checkNationalId,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  normalizePhone,
  type NationalIdType,
} from "@/lib/locale";
import { FRONT_DESK_ROLES, SEX_LABELS, practiceErrorMessage } from "@/lib/practice";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Contact = Database["public"]["Tables"]["patient_contacts"]["Row"];
type PortalLink = Database["public"]["Tables"]["patient_portal_links"]["Row"];

interface TimelineItem {
  id: string;
  kind: "appointment" | "record" | "invoice";
  at: string;
  title: string;
  detail: string;
}

interface Props {
  patientId: string | null;
  onClose: () => void;
  /** Called after details change or a merge, so the list can refresh. */
  onChanged: () => void;
}

const PatientDetailSheet = ({ patientId, onClose, onChanged }: Props) => {
  const { current, hasRole } = usePractice();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const tz = current?.timezone ?? "Africa/Gaborone";
  const canEdit = hasRole(...FRONT_DESK_ROLES);
  const canMerge = hasRole("owner", "manager");
  const canSeeLinks = hasRole("owner", "manager", "receptionist");

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    const [p, c, l, a, r, i, prov] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
      supabase.from("patient_contacts").select("*").eq("patient_id", patientId).order("created_at"),
      supabase.from("patient_portal_links").select("*").eq("patient_id", patientId),
      supabase.from("appointments").select("id, appointment_date, appointment_type, status, reason_for_visit, provider_id").eq("patient_id", patientId),
      supabase.from("medical_records").select("id, created_at, diagnosis, provider_id").eq("patient_id", patientId),
      supabase.from("invoices").select("id, created_at, invoice_number, amount, currency, status").eq("patient_id", patientId),
      supabase.from("providers").select("id, display_name"),
    ]);
    setPatient(p.data ?? null);
    setContacts(c.data ?? []);
    setLinks(l.data ?? []);
    const providerName = (id: string) => prov.data?.find((x) => x.id === id)?.display_name ?? "Provider";
    // Each query returns only what this role may see; a refused query just leaves its rows out.
    const items: TimelineItem[] = [
      ...(a.data ?? []).map((x) => ({
        id: x.id,
        kind: "appointment" as const,
        at: x.appointment_date,
        title: `${x.appointment_type === "telehealth" ? "Telehealth" : "Visit"} with ${providerName(x.provider_id)}`,
        detail: [x.status, x.reason_for_visit].filter(Boolean).join(" · "),
      })),
      ...(r.data ?? []).map((x) => ({
        id: x.id,
        kind: "record" as const,
        at: x.created_at,
        title: `Clinical note by ${providerName(x.provider_id)}`,
        detail: x.diagnosis ?? "",
      })),
      ...(i.data ?? []).map((x) => ({
        id: x.id,
        kind: "invoice" as const,
        at: x.created_at,
        title: `Invoice ${x.invoice_number}`,
        detail: `${formatMoney(x.amount, x.currency ?? current?.currency ?? "BWP")} · ${x.status}`,
      })),
    ].sort((x, y) => y.at.localeCompare(x.at));
    setTimeline(items);
    setLoading(false);
  }, [patientId, current?.currency]);

  useEffect(() => {
    setEditing(false);
    setPatient(null);
    if (!patientId) return;
    // Opening a chart is recorded in the audit log (reads can't be audited by triggers).
    supabase.rpc("log_patient_view", { _patient_id: patientId }).then(({ error }) => {
      if (error) console.error("Could not record chart view:", error.message);
    });
    load();
  }, [patientId, load]);

  const verifyLink = async (link: PortalLink) => {
    const { error } = await supabase.rpc("verify_portal_link", { _link_id: link.id });
    if (error) toast.error(practiceErrorMessage(error));
    else {
      toast.success("Portal access verified. The patient can now see this record.");
      load();
    }
  };

  const merged = patient?.status === "merged";

  return (
    <Sheet open={!!patientId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {loading && !patient ? (
          <div className="flex justify-center py-16" aria-busy="true">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !patient ? (
          <p className="py-16 text-center text-muted-foreground">This record isn't available.</p>
        ) : (
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {patient.first_name} {patient.last_name}
                {merged && <Badge variant="secondary">Merged</Badge>}
                {patient.source === "portal" && <Badge variant="outline">Self-registered online</Badge>}
              </SheetTitle>
              <SheetDescription>
                {[patient.date_of_birth && `Born ${formatCalendarDate(patient.date_of_birth)}`, patient.sex && SEX_LABELS[patient.sex]]
                  .filter(Boolean)
                  .join(" · ") || "No date of birth recorded"}
              </SheetDescription>
            </SheetHeader>

            {editing ? (
              <EditDetails
                patient={patient}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  load();
                  onChanged();
                }}
              />
            ) : (
              <section aria-labelledby="pd-details" className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 id="pd-details" className="font-semibold">
                    Details
                  </h3>
                  {canEdit && !merged && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                  )}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd>{patient.id_number ? `${ID_TYPE_LABELS[patient.id_type]} ${patient.id_number}` : "Not recorded"}</dd>
                  <dt className="text-muted-foreground">Mobile</dt>
                  <dd>{patient.phone_e164 ? formatPhone(patient.phone_e164) : "—"}</dd>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{patient.email ?? "—"}</dd>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd>{patient.address ?? "—"}</dd>
                  <dt className="text-muted-foreground">Registered</dt>
                  <dd>{formatDate(patient.created_at, tz)}</dd>
                </dl>
              </section>
            )}

            <ContactsSection patient={patient} contacts={contacts} canEdit={canEdit && !merged} onChanged={load} />

            {canSeeLinks && links.length > 0 && (
              <section aria-labelledby="pd-portal" className="space-y-2">
                <h3 id="pd-portal" className="flex items-center gap-2 font-semibold">
                  <Link2 className="h-4 w-4" /> Online portal
                </h3>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <span>
                        {link.status === "verified" ? "Verified" : "Waiting for reception to confirm identity"}
                        {link.verified_at && ` · ${formatDate(link.verified_at, tz)}`}
                      </span>
                      {link.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => verifyLink(link)}>
                          <ShieldCheck className="mr-1 h-4 w-4" /> Verify
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Verify only after checking the patient's ID in person or on a call. Verified patients can see their
                  appointments and invoices online.
                </p>
              </section>
            )}

            <section aria-labelledby="pd-timeline" className="space-y-2">
              <h3 id="pd-timeline" className="font-semibold">
                Timeline
              </h3>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ol className="space-y-2">
                  {timeline.map((t) => {
                    const Icon = t.kind === "appointment" ? Calendar : t.kind === "record" ? FileText : Receipt;
                    return (
                      <li key={`${t.kind}-${t.id}`} className="flex gap-3 rounded-lg border border-border p-3 text-sm">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(t.at, tz)}</p>
                          {t.detail && <p className="mt-1 break-words text-muted-foreground">{t.detail}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {canMerge && !merged && (
              <MergeSection
                patient={patient}
                onMerged={() => {
                  onChanged();
                  load();
                }}
              />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

/** Edit demographics. Status and merge fields can only change through merge_patients. */
const EditDetails = ({ patient, onCancel, onSaved }: { patient: Patient; onCancel: () => void; onSaved: () => void }) => {
  const { current } = usePractice();
  const [f, setF] = useState({
    first_name: patient.first_name,
    last_name: patient.last_name,
    date_of_birth: patient.date_of_birth ?? "",
    sex: patient.sex ?? "",
    id_type: patient.id_type,
    id_number: patient.id_number ?? "",
    phone: patient.phone_e164 ?? "",
    email: patient.email ?? "",
    address: patient.address ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!current) return null;
  const country = COUNTRIES[current.country];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.first_name.trim() || !f.last_name.trim()) return setError("First name and surname are required.");
    const phone = f.phone.trim() ? normalizePhone(f.phone, current.country) : null;
    if (f.phone.trim() && !phone) return setError("That mobile number isn't valid.");
    const idNumber = f.id_type === "none" ? "" : f.id_number.trim();
    const idCheck = checkNationalId(f.id_type, idNumber);
    if (idCheck.error) return setError(idCheck.error);
    setBusy(true);
    const { error: err } = await supabase
      .from("patients")
      .update({
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        date_of_birth: f.date_of_birth || null,
        sex: f.sex || null,
        id_type: f.id_type,
        id_number: idNumber || null,
        phone_e164: phone,
        email: f.email.trim() || null,
        address: f.address.trim() || null,
      })
      .eq("id", patient.id);
    setBusy(false);
    if (err) return setError(practiceErrorMessage(err, "Couldn't save the changes."));
    toast.success("Details updated.");
    onSaved();
  };

  const input = (key: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ed-${key}`}>{label}</Label>
      <Input id={`ed-${key}`} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border border-border p-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {input("first_name", "First name")}
        {input("last_name", "Surname")}
        {input("date_of_birth", "Date of birth", { type: "date" })}
        <div className="space-y-1.5">
          <Label htmlFor="ed-sex">Sex</Label>
          <Select value={f.sex} onValueChange={(v) => setF({ ...f, sex: v })}>
            <SelectTrigger id="ed-sex">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEX_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-id-type">ID type</Label>
          <Select value={f.id_type} onValueChange={(v) => setF({ ...f, id_type: v as NationalIdType })}>
            <SelectTrigger id="ed-id-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...country.idTypes, "none" as const].map((t) => (
                <SelectItem key={t} value={t}>
                  {ID_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {f.id_type !== "none" ? input("id_number", "ID number") : <div className="hidden sm:block" />}
        {input("phone", "Mobile number", { type: "tel", placeholder: `+${country.dialCode} …` })}
        {input("email", "Email", { type: "email" })}
      </div>
      {input("address", "Address")}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
};

/** Next of kin, guardians and people allowed to act for the patient. */
const ContactsSection = ({
  patient,
  contacts,
  canEdit,
  onChanged,
}: {
  patient: Patient;
  contacts: Contact[];
  canEdit: boolean;
  onChanged: () => void;
}) => {
  const { current } = usePractice();
  const [adding, setAdding] = useState(false);
  const [c, setC] = useState({ name: "", relationship: "", phone: "", responsible: false, authorized: false });
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    if (!c.name.trim() || !c.relationship.trim()) return toast.error("Enter a name and relationship.");
    const phone = c.phone.trim() ? normalizePhone(c.phone, current.country) : null;
    if (c.phone.trim() && !phone) return toast.error("That phone number isn't valid.");
    setBusy(true);
    const { error } = await supabase.from("patient_contacts").insert({
      practice_id: patient.practice_id,
      patient_id: patient.id,
      name: c.name.trim(),
      relationship: c.relationship.trim(),
      phone_e164: phone,
      is_responsible_party: c.responsible,
      is_authorized_rep: c.authorized,
    });
    setBusy(false);
    if (error) return toast.error(practiceErrorMessage(error, "Couldn't add the contact."));
    setC({ name: "", relationship: "", phone: "", responsible: false, authorized: false });
    setAdding(false);
    onChanged();
  };

  const remove = async (contact: Contact) => {
    const { error } = await supabase.from("patient_contacts").delete().eq("id", contact.id);
    if (error) toast.error(practiceErrorMessage(error, "Couldn't remove the contact."));
    else onChanged();
  };

  return (
    <section aria-labelledby="pd-contacts" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 id="pd-contacts" className="font-semibold">
          Contacts
        </h3>
        {canEdit && !adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        )}
      </div>
      {contacts.length === 0 && !adding && <p className="text-sm text-muted-foreground">No contacts recorded.</p>}
      <ul className="space-y-2">
        {contacts.map((ct) => (
          <li key={ct.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {ct.name} <span className="font-normal text-muted-foreground">({ct.relationship})</span>
              </p>
              {ct.phone_e164 && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" /> {formatPhone(ct.phone_e164)}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {ct.is_responsible_party && <Badge variant="outline">Pays the account</Badge>}
                {ct.is_authorized_rep && <Badge variant="outline">May act for patient</Badge>}
              </div>
            </div>
            {canEdit && (
              <Button size="icon" variant="ghost" aria-label={`Remove ${ct.name}`} onClick={() => remove(ct)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <form onSubmit={add} className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-name">Name</Label>
              <Input id="ct-name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-rel">Relationship</Label>
              <Input id="ct-rel" placeholder="e.g. Mother" value={c.relationship} onChange={(e) => setC({ ...c, relationship: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ct-phone">Phone</Label>
              <Input id="ct-phone" type="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={c.responsible} onCheckedChange={(v) => setC({ ...c, responsible: v === true })} />
            Pays the account (responsible party)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={c.authorized} onCheckedChange={(v) => setC({ ...c, authorized: v === true })} />
            May act for the patient (authorised representative)
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Add contact
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};

/** Merge a duplicate record into this one (owners and managers). */
const MergeSection = ({ patient, onMerged }: { patient: Patient; onMerged: () => void }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [chosen, setChosen] = useState<Patient | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const like = `%${q.replace(/[%_,()]/g, "")}%`;
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("practice_id", patient.practice_id)
        .eq("status", "active")
        .neq("id", patient.id)
        .or(`first_name.ilike.${like},last_name.ilike.${like},phone_e164.ilike.${like},id_number.ilike.${like}`)
        .limit(10);
      setResults(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, patient.id, patient.practice_id]);

  const merge = async () => {
    if (!chosen) return;
    setBusy(true);
    const { error } = await supabase.rpc("merge_patients", { _keep_id: patient.id, _merge_id: chosen.id, _reason: reason.trim() });
    setBusy(false);
    if (error) return toast.error(practiceErrorMessage(error, "Couldn't merge the records."));
    toast.success(`${chosen.first_name} ${chosen.last_name}'s record was merged into this one.`);
    setOpen(false);
    setChosen(null);
    setQuery("");
    setReason("");
    onMerged();
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <GitMerge className="mr-2 h-4 w-4" /> Merge a duplicate into this record
      </Button>
    );
  }

  return (
    <section aria-labelledby="pd-merge" className="space-y-3 rounded-lg border border-border p-4">
      <h3 id="pd-merge" className="font-semibold">
        Merge a duplicate
      </h3>
      <p className="text-sm text-muted-foreground">
        The duplicate's appointments, notes, prescriptions, invoices and contacts move to this record. The duplicate is kept
        (marked merged) so nothing is lost. This can't be undone from the app.
      </p>
      {chosen ? (
        <div className="space-y-3">
          <p className="text-sm">
            Merge <strong>{chosen.first_name} {chosen.last_name}</strong>
            {chosen.date_of_birth && ` (born ${formatCalendarDate(chosen.date_of_birth)})`} into{" "}
            <strong>{patient.first_name} {patient.last_name}</strong>.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="merge-reason">Reason (kept in the audit log)</Label>
            <Textarea id="merge-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Registered twice at reception" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setChosen(null)}>
              Back
            </Button>
            <Button variant="destructive" onClick={merge} disabled={busy || reason.trim().length < 3}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge records
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="merge-search">Find the duplicate</Label>
          <Input id="merge-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, phone or ID number" />
          <ul className="space-y-1">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setChosen(r)}
                  className="w-full rounded-md border border-border p-2 text-left text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-medium">
                    {r.first_name} {r.last_name}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {[r.date_of_birth && formatCalendarDate(r.date_of_birth), r.phone_e164 && formatPhone(r.phone_e164)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  );
};

export default PatientDetailSheet;
