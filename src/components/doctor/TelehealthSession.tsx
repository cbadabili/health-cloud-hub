import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Clock } from "lucide-react";
import DeviceCheck from "@/components/telehealth/DeviceCheck";
import VideoComingSoon from "@/components/telehealth/VideoComingSoon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchPatientContacts, type PatientContact } from "@/lib/doctorPatients";
import { useToast } from "@/hooks/use-toast";

interface TelehealthAppointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_type: string;
  status: string;
  reason_for_visit: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

const TelehealthSession = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<TelehealthAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTelehealthAppointments();
    }
  }, [user]);

  const fetchTelehealthAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user?.id)
        .ilike('appointment_type', '%telehealth%')
        .order('appointment_date', { ascending: true });

      if (error) throw error;

      // Fetch patient profiles separately
      const patientIds = [...new Set(data?.map(apt => apt.patient_id) || [])];
      let profiles: PatientContact[] = [];
      
      if (patientIds.length > 0) {
        profiles = await fetchPatientContacts(patientIds);
      }
      
      const appointmentsWithProfiles = data?.map(apt => ({
        ...apt,
        profiles: profiles.find(p => p.user_id === apt.patient_id)
      })) || [];
      
      setAppointments(appointmentsWithProfiles);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error fetching telehealth appointments",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const todayAppointments = appointments.filter(apt => {
    const today = new Date().toDateString();
    const aptDate = new Date(apt.appointment_date).toDateString();
    return aptDate === today;
  });

  const upcomingAppointments = appointments.filter(apt => {
    const today = new Date();
    const aptDate = new Date(apt.appointment_date);
    return aptDate > today;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading telehealth sessions...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <VideoComingSoon audience="doctor" />

      <DeviceCheck />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{todayAppointments.length}</div>
            <p className="text-sm text-muted-foreground">Today's Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
            <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{appointments.length}</div>
            <p className="text-sm text-muted-foreground">Total Scheduled</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">Today's Sessions</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Telehealth Sessions ({todayAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No telehealth sessions scheduled for today
                </div>
              ) : (
                <div className="space-y-4">
                  {todayAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div>
                          <p className="font-medium">
                            {[appointment.profiles?.first_name, appointment.profiles?.last_name].filter(Boolean).join(" ") || "Patient"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.reason_for_visit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{appointment.status}</Badge>
<span className="px-2 py-1 rounded-full text-xs border border-border text-muted-foreground whitespace-nowrap">
                          Video coming soon
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Upcoming Sessions ({upcomingAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming telehealth sessions
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-sm font-medium">
                            {new Date(appointment.appointment_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">
                            {[appointment.profiles?.first_name, appointment.profiles?.last_name].filter(Boolean).join(" ") || "Patient"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.reason_for_visit}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{appointment.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                All Telehealth Sessions ({appointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {new Date(appointment.appointment_date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium">
                          {[appointment.profiles?.first_name, appointment.profiles?.last_name].filter(Boolean).join(" ") || "Patient"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {appointment.reason_for_visit}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{appointment.status}</Badge>
                      {appointment.status === 'scheduled' && new Date(appointment.appointment_date) >= new Date() && (
                        <span className="px-2 py-1 rounded-full text-xs border border-border text-muted-foreground whitespace-nowrap">
                          Video coming soon
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {appointments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No telehealth sessions found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TelehealthSession;