import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { usePractice } from "@/hooks/usePractice";
import { COUNTRIES } from "@/lib/locale";
import { practiceErrorMessage } from "@/lib/practice";

/** Practice name, registration and security settings. Country, currency and time zone are fixed after set-up. */
const PracticeSettings = () => {
  const { current, refresh } = usePractice();
  const [f, setF] = useState({ name: "", legal_name: "", registration_no: "", require_mfa: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!current) return;
    supabase
      .from("practices")
      .select("name, legal_name, registration_no, require_mfa")
      .eq("id", current.practice_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setF({ name: data.name, legal_name: data.legal_name ?? "", registration_no: data.registration_no ?? "", require_mfa: data.require_mfa });
        setLoading(false);
      });
  }, [current]);

  if (!current) return null;
  const country = COUNTRIES[current.country];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Enter the practice name.");
    setBusy(true);
    const { error } = await supabase
      .from("practices")
      .update({
        name: f.name.trim(),
        legal_name: f.legal_name.trim() || null,
        registration_no: f.registration_no.trim() || null,
        require_mfa: f.require_mfa,
      })
      .eq("id", current.practice_id);
    setBusy(false);
    if (error) return toast.error(practiceErrorMessage(error, "Couldn't save settings."));
    toast.success("Settings saved.");
    refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice settings</CardTitle>
        <CardDescription>
          {country.name} · {current.currency} · {current.timezone.replace("_", " ")}. These are fixed once the practice is set
          up, so invoices and appointment times stay consistent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ps-name">Practice name</Label>
              <Input id="ps-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-legal">Legal (company) name</Label>
              <Input id="ps-legal" value={f.legal_name} onChange={(e) => setF({ ...f, legal_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-reg">{current.country === "ZA" ? "Practice number (BHF)" : "Practice registration number"}</Label>
              <Input id="ps-reg" value={f.registration_no} onChange={(e) => setF({ ...f, registration_no: e.target.value })} />
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <Label htmlFor="ps-mfa">Require two-step sign-in for staff</Label>
              <p className="text-sm text-muted-foreground">
                Strongly recommended. Staff use an authenticator app code as well as their password before seeing patient data.
              </p>
            </div>
            <Switch id="ps-mfa" checked={f.require_mfa} onCheckedChange={(v) => setF({ ...f, require_mfa: v })} />
          </div>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PracticeSettings;
