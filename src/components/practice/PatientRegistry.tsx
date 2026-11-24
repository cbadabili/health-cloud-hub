import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePractice } from "@/hooks/usePractice";
import { ID_TYPE_LABELS, formatCalendarDate, formatPhone, normalizePhone } from "@/lib/locale";
import { FRONT_DESK_ROLES } from "@/lib/practice";
import RegisterPatientDialog from "./RegisterPatientDialog";
import PatientDetailSheet from "./PatientDetailSheet";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

/** Find a patient by name, phone, date of birth or ID number; register new ones. */
const PatientRegistry = () => {
  const { current, hasRole } = usePractice();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const canRegister = hasRole(...FRONT_DESK_ROLES);

  const search = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    let q = supabase
      .from("patients")
      .select("*")
      .eq("practice_id", current.practice_id)
      .eq("status", "active")
      .order("last_name")
      .order("first_name")
      .limit(50);
    const term = query.trim().replace(/[%_,()]/g, "");
    if (term) {
      const like = `%${term}%`;
      const filters = [`first_name.ilike.${like}`, `last_name.ilike.${like}`, `id_number.ilike.${like}`, `email.ilike.${like}`];
      const phone = normalizePhone(term, current.country);
      if (phone) filters.push(`phone_e164.eq.${phone}`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(term)) filters.push(`date_of_birth.eq.${term}`);
      // "Mpho Kgosi" matches first and last name together.
      const parts = term.split(/\s+/);
      if (parts.length === 2) filters.push(`and(first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts[1]}%)`);
      q = q.or(filters.join(","));
    }
    const { data, error } = await q;
    if (error) console.error("Patient search failed:", error.message);
    setPatients(data ?? []);
    setLoading(false);
  }, [current, query]);

  useEffect(() => {
    const t = setTimeout(search, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Patients</CardTitle>
        {canRegister && (
          <Button variant="hero" onClick={() => setRegistering(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Register patient
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search patients"
            placeholder="Name, mobile, ID or birth date (YYYY-MM-DD)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8" aria-busy="true">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : patients.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            {query.trim() ? "No patients match that search." : "No patients registered yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {patients.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="flex w-full flex-col gap-1 p-3 text-left hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">
                    {p.last_name}, {p.first_name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {[
                      p.date_of_birth && formatCalendarDate(p.date_of_birth),
                      p.phone_e164 && formatPhone(p.phone_e164),
                      p.id_number && `${ID_TYPE_LABELS[p.id_type]} ${p.id_number}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {patients.length === 50 && <p className="text-xs text-muted-foreground">Showing the first 50. Narrow your search to see more.</p>}
      </CardContent>

      <RegisterPatientDialog
        open={registering}
        onOpenChange={setRegistering}
        onDone={(id) => {
          search();
          setOpenId(id);
        }}
      />
      <PatientDetailSheet patientId={openId} onClose={() => setOpenId(null)} onChanged={search} />
    </Card>
  );
};

export default PatientRegistry;
