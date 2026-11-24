import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, MailPlus, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { usePractice, type PracticeRole } from "@/hooks/usePractice";
import { formatDate } from "@/lib/locale";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, practiceErrorMessage } from "@/lib/practice";

type StaffRow = Database["public"]["Functions"]["practice_staff_directory"]["Returns"][number];
type Invitation = Database["public"]["Tables"]["staff_invitations"]["Row"];
type Site = Database["public"]["Tables"]["sites"]["Row"];

/** Invite, re-scope and remove staff (owners and managers). */
const StaffAdmin = () => {
  const { user } = useAuth();
  const { current, hasRole, refresh } = usePractice();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const isOwner = hasRole("owner");
  const tz = current?.timezone ?? "Africa/Gaborone";

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const [s, i, si] = await Promise.all([
      supabase.rpc("practice_staff_directory", { _practice_id: current.practice_id }),
      supabase
        .from("staff_invitations")
        .select("*")
        .eq("practice_id", current.practice_id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("sites").select("*").eq("practice_id", current.practice_id).eq("active", true).order("name"),
    ]);
    if (s.error) toast.error(practiceErrorMessage(s.error, "Couldn't load staff."));
    setStaff((s.data ?? []).filter((r) => r.active));
    setInvites(i.data ?? []);
    setSites(si.data ?? []);
    setLoading(false);
  }, [current]);

  useEffect(() => {
    load();
  }, [load]);

  const deactivate = async (row: StaffRow) => {
    const { error } = await supabase.rpc("deactivate_staff", { _membership_id: row.membership_id });
    if (error) return toast.error(practiceErrorMessage(error, "Couldn't remove this role."));
    toast.success(`${name(row)} no longer has the ${ROLE_LABELS[row.role]} role. Their access stopped immediately.`);
    if (row.user_id === user?.id) await refresh();
    load();
  };

  const revoke = async (inv: Invitation) => {
    const { error } = await supabase.rpc("revoke_invitation", { _invitation_id: inv.id });
    if (error) return toast.error(practiceErrorMessage(error));
    toast.success("Invitation cancelled.");
    load();
  };

  const siteNames = (row: StaffRow) =>
    row.all_sites ? "All sites" : row.site_ids.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "No sites";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Staff</CardTitle>
            <CardDescription>Each role is listed separately. Removing a role stops that access on the person's next action.</CardDescription>
          </div>
          <Button variant="hero" onClick={() => setInviting(true)}>
            <MailPlus className="mr-2 h-4 w-4" /> Invite staff
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8" aria-busy="true">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {staff.map((row) => (
                <li key={row.membership_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {name(row)} {row.user_id === user?.id && <span className="text-muted-foreground">(you)</span>}
                    </p>
                    <p className="break-all text-sm text-muted-foreground">{row.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">{ROLE_LABELS[row.role]}</Badge>
                      <Badge variant="outline">{siteNames(row)}</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {sites.length > 1 && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                        Sites
                      </Button>
                    )}
                    {(row.role !== "owner" || isOwner) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <UserX className="mr-1 h-4 w-4" /> Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remove {name(row)}'s {ROLE_LABELS[row.role]} role?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Their access through this role stops immediately. Records they created stay in the practice. You
                              can invite them again later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deactivate(row)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove role
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Waiting to accept</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all font-medium">{inv.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_LABELS[inv.role]} · expires {formatDate(inv.expires_at, tz)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => revoke(inv)}>
                    Cancel invitation
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <InviteDialog open={inviting} onOpenChange={setInviting} sites={sites} isOwner={isOwner} onInvited={load} />
      {editing && <SitesDialog row={editing} sites={sites} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
};

const name = (row: StaffRow) => [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "Staff member";

const SitePicker = ({
  sites,
  allSites,
  setAllSites,
  siteIds,
  setSiteIds,
}: {
  sites: Site[];
  allSites: boolean;
  setAllSites: (v: boolean) => void;
  siteIds: string[];
  setSiteIds: (v: string[]) => void;
}) => (
  <fieldset className="space-y-2">
    <legend className="text-sm font-medium">Sites</legend>
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={allSites} onCheckedChange={(v) => setAllSites(v === true)} />
      All sites, including new ones
    </label>
    {!allSites &&
      sites.map((s) => (
        <label key={s.id} className="ml-6 flex items-center gap-2 text-sm">
          <Checkbox
            checked={siteIds.includes(s.id)}
            onCheckedChange={(v) => setSiteIds(v === true ? [...siteIds, s.id] : siteIds.filter((x) => x !== s.id))}
          />
          {s.name}
        </label>
      ))}
  </fieldset>
);

const InviteDialog = ({
  open,
  onOpenChange,
  sites,
  isOwner,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sites: Site[];
  isOwner: boolean;
  onInvited: () => void;
}) => {
  const { current } = usePractice();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PracticeRole>("receptionist");
  const [allSites, setAllSites] = useState(true);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (o: boolean) => {
    if (!o) {
      setEmail("");
      setRole("receptionist");
      setAllSites(true);
      setSiteIds([]);
      setLink(null);
    }
    onOpenChange(o);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("invite_staff", {
      _practice_id: current.practice_id,
      _email: email.trim().toLowerCase(),
      _role: role,
      _all_sites: allSites,
      _site_ids: allSites ? [] : siteIds,
    });
    setBusy(false);
    if (error || !data) return toast.error(practiceErrorMessage(error, "Couldn't create the invitation."));
    setLink(`${window.location.origin}/invite/${data}`);
    onInvited();
  };

  const roles = (Object.keys(ROLE_LABELS) as PracticeRole[]).filter((r) => r !== "owner" || isOwner);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{link ? "Send this link" : "Invite a staff member"}</DialogTitle>
          <DialogDescription>
            {link
              ? "Send this one-time link to them by email or WhatsApp. It works only for the email address you entered and expires in 7 days. You won't see it again."
              : "They'll sign in (or create an account) with this email address to join."}
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="space-y-3">
            <Input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Invitation link" />
            <DialogFooter>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    toast.success("Link copied.");
                  } catch {
                    toast.error("Couldn't copy. Select the link and copy it manually.");
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy link
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as PracticeRole)}>
                <SelectTrigger id="inv-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              {role === "clinician" && (
                <p className="text-xs text-muted-foreground">
                  Clinicians verify their registration with the council before they can open clinical notes.
                </p>
              )}
            </div>
            {sites.length > 1 && <SitePicker sites={sites} allSites={allSites} setAllSites={setAllSites} siteIds={siteIds} setSiteIds={setSiteIds} />}
            <DialogFooter>
              <Button type="submit" variant="hero" disabled={busy || (!allSites && siteIds.length === 0)}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const SitesDialog = ({ row, sites, onClose, onSaved }: { row: StaffRow; sites: Site[]; onClose: () => void; onSaved: () => void }) => {
  const [allSites, setAllSites] = useState(row.all_sites);
  const [siteIds, setSiteIds] = useState<string[]>(row.site_ids);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("set_staff_sites", {
      _membership_id: row.membership_id,
      _all_sites: allSites,
      _site_ids: allSites ? [] : siteIds,
    });
    setBusy(false);
    if (error) return toast.error(practiceErrorMessage(error));
    toast.success("Sites updated.");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sites for {name(row)}</DialogTitle>
          <DialogDescription>{ROLE_LABELS[row.role]} role. Appointments and records at other sites are hidden.</DialogDescription>
        </DialogHeader>
        <SitePicker sites={sites} allSites={allSites} setAllSites={setAllSites} siteIds={siteIds} setSiteIds={setSiteIds} />
        <DialogFooter>
          <Button onClick={save} disabled={busy || (!allSites && siteIds.length === 0)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaffAdmin;
