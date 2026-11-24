import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminDashboard from "@/components/dashboards/SuperAdminDashboard";
import PatientDashboard from "@/components/dashboards/PatientDashboard";
import DoctorVerificationGate from "@/components/doctor/DoctorVerificationGate";
import StaffWorkspace from "@/pages/practice/StaffWorkspace";
import { usePractice } from "@/hooks/usePractice";
import { isVerificationTableMissing, type DoctorVerification } from "@/lib/doctorVerification";
import { Loader2 } from "lucide-react";

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center" aria-live="polite" aria-busy="true">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

/** Shown when the app is newer than the database (tenancy migration not applied yet). */
const DatabaseUpdateNeeded = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div role="status" className="max-w-md text-center space-y-2">
      <h2 className="text-2xl font-bold text-foreground">Practice features aren't switched on yet</h2>
      <p className="text-muted-foreground">
        The database needs the latest update before practices and patient records can be used. If you manage
        Clinithetics, run the pending migrations in the Supabase SQL editor. Otherwise, please try again later.
      </p>
    </div>
  </div>
);

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { practices, loading: practicesLoading, notSetUp } = usePractice();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<DoctorVerification | null>(null);
  // false until the verification migration has been applied to the database
  const [verificationEnabled, setVerificationEnabled] = useState(true);

  // Doctors need an approved registration before they work with patient data.
  // (The database enforces this too; this just shows the right screen.)
  const fetchVerification = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("doctor_verifications")
      .select("*")
      .eq("doctor_id", user.id)
      .maybeSingle();
    if (error) {
      if (isVerificationTableMissing(error)) {
        setVerificationEnabled(false);
        return;
      }
      console.error("Error fetching verification:", error);
    }
    setVerificationEnabled(true);
    setVerification(data ?? null);
  }, [user]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (error) console.error("Error fetching user role:", error);
      setUserRole(data?.role ?? null);
      if (data?.role === "doctor") await fetchVerification();
      setLoading(false);
    };
    if (!authLoading) fetchUserRole();
  }, [user, authLoading, fetchVerification]);

  if (authLoading || loading || practicesLoading) return <Spinner />;
  if (!user) return null;
  if (notSetUp) return <DatabaseUpdateNeeded />;

  // Practitioners verify their registration first.
  if (userRole === "doctor" && verificationEnabled && verification?.status !== "approved") {
    return <DoctorVerificationGate verification={verification} onChange={fetchVerification} />;
  }

  // Anyone with a practice membership works in the staff workspace.
  if (practices.length > 0) return <StaffWorkspace />;

  if (userRole === "super_admin") return <SuperAdminDashboard />;

  // A verified practitioner without a practice sets one up.
  if (userRole === "doctor") return <Navigate to="/onboarding" replace />;

  return <PatientDashboard />;
};

export default Dashboard;
