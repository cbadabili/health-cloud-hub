import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Calendar, Clock, Info, Loader2, MapPin, Stethoscope, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { formatDate } from "@/lib/locale";
import {
  TIME_SLOTS,
  bookingErrorMessage,
  doctorName,
  formatFee,
  isBookingNotSetUp,
  localDayRange,
  myPortalPatientIds,
  slotToDate,
  toSlotTime,
  todayLocal,
} from "@/lib/booking";

type BookableDoctor = Database["public"]["Functions"]["list_bookable_providers"]["Returns"][number];

interface UpcomingAppointment {
  id: string;
  provider_id: string;
  appointment_date: string;
  appointment_type: string;
  reason_for_visit: string | null;
}

const DEFAULT_TZ = "Africa/Gaborone";

const AppointmentBooking = () => {
  const { user } = useAuth();

  const [doctors, setDoctors] = useState<BookableDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [bookingSetUp, setBookingSetUp] = useState(true);

  const [appointments, setAppointments] = useState<UpcomingAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");
  const [takenSlots, setTakenSlots] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    const { data, error } = await supabase.rpc("list_bookable_providers");
    if (error) {
      if (isBookingNotSetUp(error)) setBookingSetUp(false);
      else toast.error("Could not load doctors. Please try again.");
    } else {
      setBookingSetUp(true);
      setDoctors(data ?? []);
    }
    setLoadingDoctors(false);
  }, []);

  const loadAppointments = useCallback(async () => {
    if (!user) return;
    setLoadingAppointments(true);
    const patientIds = await myPortalPatientIds(user.id);
    if (patientIds.length === 0) {
      setAppointments([]);
      setLoadingAppointments(false);
      return;
    }
    const { data, error } = await supabase
      .from("appointments")
      .select("id, provider_id, appointment_date, appointment_type, reason_for_visit")
      .in("patient_id", patientIds)
      .eq("status", "scheduled")
      .gte("appointment_date", new Date().toISOString())
      .order("appointment_date", { ascending: true });
    if (error) toast.error("Could not load your appointments.");
    setAppointments(data ?? []);
    setLoadingAppointments(false);
  }, [user]);

  const doctorsById = useMemo(() => new Map(doctors.map((d) => [d.provider_id, d])), [doctors]);
  const selected = doctorsById.get(selectedDoctor);
  const selectedTz = selected?.timezone ?? DEFAULT_TZ;

  // Times already taken for the chosen doctor and day.
  const loadTakenSlots = useCallback(async () => {
    if (!selectedDoctor || !selectedDate) {
      setTakenSlots(new Set());
      return;
    }
    setLoadingSlots(true);
    const tz = doctorsById.get(selectedDoctor)?.timezone ?? DEFAULT_TZ;
    const { from, to } = localDayRange(selectedDate, tz);
    const { data, error } = await supabase.rpc("provider_booked_slots", {
      _provider_id: selectedDoctor,
      _from: from,
      _to: to,
    });
    setTakenSlots(error ? new Set() : new Set((data ?? []).map((iso) => toSlotTime(iso, tz))));
    setLoadingSlots(false);
  }, [selectedDoctor, selectedDate, doctorsById]);

  useEffect(() => {
    loadDoctors();
    loadAppointments();
  }, [loadDoctors, loadAppointments]);

  useEffect(() => {
    loadTakenSlots();
  }, [loadTakenSlots]);

  /** A slot is unavailable if it's booked, or already past (for today). */
  const isSlotUnavailable = (time: string) =>
    takenSlots.has(time) || (selectedDate !== "" && slotToDate(selectedDate, time, selectedTz) <= new Date());

  // Clear a chosen time that has become unavailable.
  useEffect(() => {
    if (selectedTime && selectedDate && isSlotUnavailable(selectedTime)) setSelectedTime("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takenSlots, selectedDate]);

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime || reason.trim().length < 3) {
      toast.error("Please choose a doctor, date and time, and tell us the reason for your visit.");
      return;
    }

    const startsAt = slotToDate(selectedDate, selectedTime, selectedTz);
    setSubmitting(true);
    const { error } = await supabase.rpc("book_appointment", {
      _provider_id: selectedDoctor,
      _starts_at: startsAt.toISOString(),
      _reason: reason.trim(),
    });
    setSubmitting(false);

    if (error) {
      toast.error(bookingErrorMessage(error) ?? "Could not book the appointment. Please try again.");
      loadTakenSlots();
      return;
    }

    toast.success(
      `Appointment booked with ${doctorName(selected?.display_name)} at ${selected?.practice_name ?? "the practice"} on ${formatDate(startsAt.toISOString(), selectedTz)} at ${selectedTime}.`,
    );
    setSelectedDate("");
    setSelectedTime("");
    setReason("");
    loadAppointments();
  };

  const handleCancelAppointment = async (appointment: UpcomingAppointment) => {
    setCancelling(appointment.id);
    const { error } = await supabase.rpc("cancel_my_appointment", { _appointment_id: appointment.id });
    setCancelling(null);
    if (error) {
      toast.error(bookingErrorMessage(error) ?? "Could not cancel the appointment. Please try again.");
      return;
    }
    toast.success("Your appointment has been cancelled.");
    loadAppointments();
    loadTakenSlots();
  };

  const nameFor = (doctorId: string) => {
    return doctorName(doctorsById.get(doctorId)?.display_name);
  };

  return (
    <div className="space-y-6">
      {/* Book New Appointment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Book New Appointment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!bookingSetUp ? (
            <p role="status" className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Online booking isn't available yet. Please contact your practice to make an appointment.
            </p>
          ) : !loadingDoctors && doctors.length === 0 ? (
            <p role="status" className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No doctors are available for online booking yet. Please contact your practice to make an appointment.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doctor">Doctor</Label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor} disabled={loadingDoctors}>
                    <SelectTrigger id="doctor">
                      <SelectValue placeholder={loadingDoctors ? "Loading doctors..." : "Choose a doctor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => {
                        const fee = formatFee(doctor.consultation_fee, doctor.currency);
                        return (
                          <SelectItem key={doctor.provider_id} value={doctor.provider_id}>
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4" />
                              <div>
                                <p className="font-medium">{doctorName(doctor.display_name)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {[doctor.practice_name, doctor.specialization, fee].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={todayLocal(selectedTz)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Select
                    value={selectedTime}
                    onValueChange={setSelectedTime}
                    disabled={!selectedDoctor || !selectedDate || loadingSlots}
                  >
                    <SelectTrigger id="time">
                      <SelectValue
                        placeholder={
                          !selectedDoctor || !selectedDate
                            ? "Choose a doctor and date first"
                            : loadingSlots
                              ? "Checking availability..."
                              : "Choose a time"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((time) => {
                        const unavailable = isSlotUnavailable(time);
                        return (
                          <SelectItem key={time} value={time} disabled={unavailable}>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {time}
                              {takenSlots.has(time) && (
                                <span className="text-xs text-muted-foreground">(booked)</span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for visit</Label>
                  <Textarea
                    id="reason"
                    placeholder="Briefly describe your symptoms or the reason for your visit"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                  />
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                Online booking is for in-person visits. Video consultations are coming soon.
              </p>

              <Button onClick={handleBookAppointment} className="w-full md:w-auto" disabled={submitting || loadingDoctors}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  "Book Appointment"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAppointments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading appointments" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              You have no upcoming appointments.
              {bookingSetUp && doctors.length > 0 && " Book one above."}
            </div>
          ) : (
            <ul className="space-y-4">
              {appointments.map((appointment) => {
                const doctor = doctorsById.get(appointment.provider_id);
                const tz = doctor?.timezone ?? DEFAULT_TZ;
                const day = formatDate(appointment.appointment_date, tz);
                const name = nameFor(appointment.provider_id);
                return (
                  <li
                    key={appointment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold">{name}</h4>
                        {doctor && (
                          <p className="text-sm text-muted-foreground">
                            {[doctor.practice_name, doctor.specialization].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {day}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {toSlotTime(appointment.appointment_date, tz)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {appointment.appointment_type === "telehealth" ? "Telehealth" : "In person"}
                          </span>
                        </div>
                        {appointment.reason_for_visit && (
                          <p className="mt-1 text-sm text-muted-foreground break-words">
                            {appointment.reason_for_visit}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300">
                        Booked
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={cancelling === appointment.id}>
                            {cancelling === appointment.id ? "Cancelling..." : "Cancel"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Your appointment with {name} on {day} at{" "}
                              {toSlotTime(appointment.appointment_date, tz)} will be cancelled and the time released.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancelAppointment(appointment)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Cancel appointment
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentBooking;
