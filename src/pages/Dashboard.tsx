import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminDashboard from "@/components/dashboards/SuperAdminDashboard";
import DoctorDashboard from "@/components/dashboards/DoctorDashboard";
import PatientDashboard from "@/components/dashboards/PatientDashboard";
import DoctorVerificationGate from "@/components/doctor/DoctorVerificationGate";
import { isVerificationTableMissing, type DoctorVerification } from "@/lib/doctorVerification";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<DoctorVerification | null>(null);
  // false until the verification migration has been applied to the database
  const [verificationEnabled, setVerificationEnabled] = useState(true);

  // Doctors only reach the dashboard once an admin has approved their registration.
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

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          return;
        }

        setUserRole(data.role);
        if (data.role === "doctor") {
          await fetchVerification();
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchUserRole();
    }
  }, [user, authLoading, fetchVerification]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Render appropriate dashboard based on user role
  switch (userRole) {
    case "super_admin":
      return <SuperAdminDashboard />;
    case "doctor":
      return !verificationEnabled || verification?.status === "approved" ? (
        <DoctorDashboard />
      ) : (
        <DoctorVerificationGate verification={verification} onChange={fetchVerification} />
      );
    case "patient":
      return <PatientDashboard />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Unable to determine your role. Please contact support.</p>
          </div>
        </div>
      );
  }
};

export default Dashboard;
