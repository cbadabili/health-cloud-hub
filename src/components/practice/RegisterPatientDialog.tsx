import { useState } from "react";
import { AlertTriangle, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePractice } from "@/hooks/usePractice";
import {
  COUNTRIES,
  ID_TYPE_LABELS,
  checkNationalId,
  formatCalendarDate,
  formatPhone,
  normalizePhone,
  todayIn,
  type NationalIdType,
} from "@/lib/locale";
import { SEX_LABELS, practiceErrorMessage } from "@/lib/practice";

interface Duplicate {
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone_e164: string | null;
  reason: string;
}

const REASON_LABELS: Record<string, string> = {
  same_id_number: "Same ID number",
  same_phone: "Same phone number",
  same_birth_date_and_surname: "Same date of birth and surname",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new (or chosen existing) patient id. */
  onDone: (patientId: string) => void;
}

const empty = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  sex: "",
  id_type: "none" as NationalIdType,
  id_number: "",
  phone: "",
  email: "",
  address: "",
};

/** Register a patient at the front desk. No national ID or login is needed. */
const RegisterPatientDialog = ({ open, onOpenChange, onDone }: Props) => {
  const { current } = usePractice();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (!current) return null;
  const country = COUNTRIES[current.country];
  const idCheck = checkNationalId(form.id_type, form.id_number.trim());
  const set = (key: keyof typeof empty, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDuplicates(null);
  };

  const close = (next: boolean) => {
    if (!next) {
      setForm(empty);
      setErrors({});
      setDuplicates(null);
    }
    onOpenChange(next);
  };

  const submit = async (confirmNew: boolean) => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Enter a first name.";
    if (!form.last_name.trim()) e.last_name = "Enter a surname.";
    const phone = form.phone.trim() ? normalizePhone(form.phone, current.country) : null;
    if (form.phone.trim() && !phone) e.phone = `Enter a valid number, e.g. +${country.dialCode} …`;
    if (idCheck.error) e.id_number = idCheck.error;
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    const { data, error } = await supabase.rpc("register_patient", {
      _practice_id: current.practice_id,
      _first_name: form.first_name.trim(),
      _last_name: form.last_name.trim(),
      _date_of_birth: form.date_of_birth || null,
      _sex: form.sex || null,
      _id_type: form.id_type,
      _id_number: form.id_type === "none" ? null : form.id_number.trim() || null,
      _phone_e164: phone,
      _email: form.email.trim() || null,
      _address: form.address.trim() || null,
      _confirm_new: confirmNew,
    });
    setBusy(false);
    if (error) {
      toast.error(practiceErrorMessage(error, "Couldn't register the patient. Please try again."));
      return;
    }
    const result = data as unknown as { patient_id: string | null; duplicates: Duplicate[] | null };
    if (!result.patient_id) {
      setDuplicates(result.duplicates ?? []);
      return;
    }
    toast.success(`${form.first_name.trim()} ${form.last_name.trim()} registered.`);
    onDone(result.patient_id);
    close(false);
  };

  const field = (key: keyof typeof empty, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`reg-${key}`}>{label}</Label>
      <Input
        id={`reg-${key}`}
        value={form[key]}
        onChange={(ev) => set(key, ev.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `reg-${key}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <p id={`reg-${key}-error`} className="text-xs text-destructive">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a patient</DialogTitle>
          <DialogDescription>Only a name is required. Add an ID or phone number to help find them later.</DialogDescription>
        </DialogHeader>

        {duplicates ? (
          <div className="space-y-3">
            <div role="alert" className="flex gap-2 rounded-md border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>This might be someone already registered. Open the existing record if it's the same person.</p>
            </div>
            <ul className="space-y-2">
              {duplicates.map((d) => (
                <li key={d.patient_id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {d.first_name} {d.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[d.date_of_birth && formatCalendarDate(d.date_of_birth), d.phone_e164 && formatPhone(d.phone_e164), REASON_LABELS[d.reason] ?? d.reason]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onDone(d.patient_id);
                      close(false);
                    }}
                  >
                    Open this record
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setDuplicates(null)}>
                Back to form
              </Button>
              <Button variant="outline" onClick={() => submit(true)} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                It's a different person, register anyway
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              submit(false);
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("first_name", "First name *", { autoComplete: "off", autoFocus: true })}
              {field("last_name", "Surname *", { autoComplete: "off" })}
              {field("date_of_birth", "Date of birth", { type: "date", max: todayIn(current.timezone) })}
              <div className="space-y-1.5">
                <Label htmlFor="reg-sex">Sex</Label>
                <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                  <SelectTrigger id="reg-sex">
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
                <Label htmlFor="reg-id-type">ID type</Label>
                <Select value={form.id_type} onValueChange={(v) => set("id_type", v)}>
                  <SelectTrigger id="reg-id-type">
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
              {form.id_type !== "none" ? (
                <div className="space-y-1.5">
                  {field("id_number", "ID number", { autoComplete: "off", inputMode: form.id_type === "passport" ? "text" : "numeric" })}
                  {!errors.id_number && idCheck.warning && <p className="text-xs text-amber-700 dark:text-amber-300">{idCheck.warning}</p>}
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}
              {field("phone", "Mobile number", { type: "tel", autoComplete: "off", placeholder: `+${country.dialCode} …` })}
              {field("email", "Email", { type: "email", autoComplete: "off" })}
            </div>
            {field("address", "Address", { autoComplete: "off" })}
            <DialogFooter>
              <Button type="submit" variant="hero" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Register patient
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RegisterPatientDialog;
