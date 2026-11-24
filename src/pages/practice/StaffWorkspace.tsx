import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, FileText, LogOut, Pill, Settings, Stethoscope, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThemeToggle from "@/components/ThemeToggle";
import StaffMfaGate from "@/components/mfa/StaffMfaGate";
import PatientRegistry from "@/components/practice/PatientRegistry";
import StaffAdmin from "@/components/practice/admin/StaffAdmin";
import SitesAdmin from "@/components/practice/admin/SitesAdmin";
import PracticeSettings from "@/components/practice/admin/PracticeSettings";
import AuditLog from "@/components/practice/admin/AuditLog";
import AppointmentScheduler from "@/components/doctor/AppointmentScheduler";
import PatientRecords from "@/components/doctor/PatientRecords";
import PrescriptionManager from "@/components/doctor/PrescriptionManager";
import TelehealthSession from "@/components/doctor/TelehealthSession";
import { useAuth } from "@/hooks/useAuth";
import { usePractice } from "@/hooks/usePractice";
import { COUNTRIES } from "@/lib/locale";
import { ROLE_LABELS } from "@/lib/practice";

/** The staff app: one practice at a time, tabs shown by role. */
const StaffWorkspace = () => {
  const { signOut } = useAuth();
  const { practices, current, setCurrentId, refresh, hasRole } = usePractice();

  const tabs = useMemo(() => {
    const t: { id: string; label: string; icon: typeof Users }[] = [{ id: "patients", label: "Patients", icon: Users }];
    // Clinical screens work on the clinician's own provider record.
    if (current?.provider_id) {
      t.push(
        { id: "appointments", label: "My diary", icon: Calendar },
        { id: "records", label: "Notes", icon: FileText },
        { id: "prescriptions", label: "Prescriptions", icon: Pill },
        { id: "telehealth", label: "Telehealth", icon: Video },
      );
    }
    if (hasRole("owner", "manager")) {
      t.push(
        { id: "staff", label: "Staff", icon: Users },
        { id: "sites", label: "Sites & rooms", icon: Settings },
        { id: "settings", label: "Settings", icon: Settings },
        { id: "audit", label: "Audit log", icon: FileText },
      );
    }
    return t;
  }, [current?.provider_id, hasRole]);

  const [tab, setTab] = useState("patients");
  // Switching practice can remove tabs; fall back to Patients.
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab("patients");
  }, [tabs, tab]);

  if (!current) return null;

  return (
    <StaffMfaGate key={current.practice_id} required={current.require_mfa} onVerified={refresh}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/" className="shrink-0 rounded-lg bg-gradient-primary p-2 hover:opacity-80" aria-label="Go to home page">
                <Stethoscope className="h-6 w-6 text-primary-foreground" />
              </Link>
              <div className="min-w-0">
                {practices.length > 1 ? (
                  <Select value={current.practice_id} onValueChange={setCurrentId}>
                    <SelectTrigger className="h-8 w-auto max-w-[16rem] border-none px-0 text-base font-semibold shadow-none focus:ring-0" aria-label="Switch practice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {practices.map((p) => (
                        <SelectItem key={p.practice_id} value={p.practice_id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <h1 className="truncate text-base font-semibold">{current.name}</h1>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {current.roles.map((r) => ROLE_LABELS[r]).join(", ")} · {COUNTRIES[current.country].name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <TabsList className="w-max">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <TabsTrigger key={id} value={id} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="patients">
              <PatientRegistry />
            </TabsContent>
            {current.provider_id && (
              <>
                <TabsContent value="appointments">
                  <AppointmentScheduler />
                </TabsContent>
                <TabsContent value="records">
                  <PatientRecords />
                </TabsContent>
                <TabsContent value="prescriptions">
                  <PrescriptionManager />
                </TabsContent>
                <TabsContent value="telehealth">
                  <TelehealthSession />
                </TabsContent>
              </>
            )}
            {hasRole("owner", "manager") && (
              <>
                <TabsContent value="staff">
                  <StaffAdmin />
                </TabsContent>
                <TabsContent value="sites">
                  <SitesAdmin />
                </TabsContent>
                <TabsContent value="settings">
                  <PracticeSettings />
                </TabsContent>
                <TabsContent value="audit">
                  <AuditLog />
                </TabsContent>
              </>
            )}
          </Tabs>
        </main>
      </div>
    </StaffMfaGate>
  );
};

export default StaffWorkspace;
