import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, HelpCircle, Loader2, Mail, Siren, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DeviceCheck from "@/components/telehealth/DeviceCheck";
import VideoComingSoon from "@/components/telehealth/VideoComingSoon";
import { companyConfig } from "@/content/companyConfig";
import { doctorName, toSlotTime } from "@/lib/booking";

interface TelehealthAppointment {
  id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason_for_visit: string | null;
}

interface DoctorInfo {
  doctor_id: string;
  first_name: string | null;
  last_name: string | null;
  specialization: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

/**
 * Patient telehealth tab. Video calls aren't available yet, so this shows the
 * patient's real telehealth appointments, an honest notice, and a working
 * camera/microphone check.
 */
const TelehealthAccess = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<TelehealthAppointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data }, { data: doctorData }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, doctor_id, appointment_date, status, reason_for_visit")
        .eq("patient_id", user.id)
        .eq("appointment_type", "telehealth")
        .order("appointment_date", { ascending: true }),
      // Names of verified doctors (fails quietly if booking isn't set up yet).
      supabase.rpc("list_bookable_doctors"),
    ]);
    setAppointments(data ?? []);
    setDoctors(doctorData ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const doctorsById = useMemo(() => new Map(doctors.map((d) => [d.doctor_id, d])), [doctors]);
  const now = new Date();
  const upcoming = appointments.filter((a) => a.status === "scheduled" && new Date(a.appointment_date) >= now);
  const past = appointments.filter((a) => !(a.status === "scheduled" && new Date(a.appointment_date) >= now)).reverse();

  const renderAppointment = (appointment: TelehealthAppointment, isUpcoming: boolean) => {
    const doctor = doctorsById.get(appointment.doctor_id);
    const when = new Date(appointment.appointment_date);
    return (
      <li key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-2 bg-medical-light-blue rounded-lg shrink-0">
            <Video className="h-5 w-5 text-medical-blue" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold">{doctorName(doctor?.first_name, doctor?.last_name)}</h4>
            {doctor?.specialization && <p className="text-sm text-muted-foreground">{doctor.specialization}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {when.toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {toSlotTime(appointment.appointment_date)}
              </span>
            </div>
            {appointment.reason_for_visit && (
              <p className="mt-1 text-sm text-muted-foreground break-words">{appointment.reason_for_visit}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
            {STATUS_LABELS[appointment.status] ?? appointment.status}
          </span>
          {isUpcoming && (
            <span className="px-2 py-1 rounded-full text-xs border border-border text-muted-foreground">
              Video coming soon
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <VideoComingSoon audience="patient" />

      <DeviceCheck />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Your telehealth appointments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading telehealth appointments" />
            </div>
          ) : appointments.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">You don't have any telehealth appointments.</p>
          ) : (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Upcoming</h3>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming telehealth appointments.</p>
                ) : (
                  <ul className="space-y-3">{upcoming.map((a) => renderAppointment(a, true))}</ul>
                )}
              </div>
              {past.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Past and cancelled</h3>
                  <ul className="space-y-3">{past.slice(0, 10).map((a) => renderAppointment(a, false))}</ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Need help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">About an appointment:</strong> please contact your practice directly.
          </p>
          {companyConfig.contactEmail && (
            <p className="flex flex-wrap items-center gap-1">
              <strong className="text-foreground">Technical problems with Clinithetics:</strong>
              <a
                href={`mailto:${companyConfig.contactEmail}`}
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                {companyConfig.contactEmail}
              </a>
            </p>
          )}
          <p className="flex items-center gap-1">
            <Siren className="h-3.5 w-3.5 shrink-0" />
            In an emergency, call your local emergency number. Clinithetics isn't an emergency service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelehealthAccess;
