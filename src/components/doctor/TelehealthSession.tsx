import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Phone, MessageSquare, Clock, User, Camera, Mic, MicOff, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const [activeSession, setActiveSession] = useState<TelehealthAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

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
      let profiles: any[] = [];
      
      if (patientIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', patientIds);
        profiles = profilesData || [];
      }
      
      const appointmentsWithProfiles = data?.map(apt => ({
        ...apt,
        profiles: profiles.find(p => p.user_id === apt.patient_id)
      })) || [];
      
      setAppointments(appointmentsWithProfiles);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching telehealth appointments",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const startSession = (appointment: TelehealthAppointment) => {
    setActiveSession(appointment);
    toast({
      title: "Session started",
      description: `Video call with ${appointment.profiles?.first_name} ${appointment.profiles?.last_name}`
    });
  };

  const endSession = () => {
    setActiveSession(null);
    toast({
      title: "Session ended",
      description: "Video call has been terminated"
    });
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

  if (activeSession) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Video Session - {activeSession.profiles?.first_name} {activeSession.profiles?.last_name}
              </div>
              <Badge className="bg-green-100 text-green-800">Live</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Video Area */}
              <div className="lg:col-span-2 space-y-4">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative">
                  <User className="h-24 w-24 text-muted-foreground" />
                  <div className="absolute bottom-4 right-4 w-32 h-24 bg-card border rounded-lg flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                
                {/* Video Controls */}
                <div className="flex justify-center gap-4">
                  <Button
                    variant={isMicOn ? "default" : "destructive"}
                    size="lg"
                    onClick={() => setIsMicOn(!isMicOn)}
                  >
                    {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant={isVideoOn ? "default" : "destructive"}
                    size="lg"
                    onClick={() => setIsVideoOn(!isVideoOn)}
                  >
                    {isVideoOn ? <Camera className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>
                  <Button variant="destructive" size="lg" onClick={endSession}>
                    End Call
                  </Button>
                </div>
              </div>
              
              {/* Session Info & Notes */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Session Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p><strong>Patient:</strong> {activeSession.profiles?.first_name} {activeSession.profiles?.last_name}</p>
                    <p><strong>Reason:</strong> {activeSession.reason_for_visit}</p>
                    <p><strong>Time:</strong> {new Date(activeSession.appointment_date).toLocaleString()}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Session Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <textarea 
                      className="w-full h-32 p-3 border rounded-lg resize-none"
                      placeholder="Add session notes..."
                    />
                    <Button className="mt-2 w-full">Save Notes</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                    <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div>
                          <p className="font-medium">
                            {appointment.profiles?.first_name} {appointment.profiles?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.reason_for_visit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{appointment.status}</Badge>
                        <Button onClick={() => startSession(appointment)}>
                          <Video className="h-4 w-4 mr-2" />
                          Start Session
                        </Button>
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
                    <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                            {appointment.profiles?.first_name} {appointment.profiles?.last_name}
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
                  <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                          {appointment.profiles?.first_name} {appointment.profiles?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {appointment.reason_for_visit}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{appointment.status}</Badge>
                      {appointment.status === 'scheduled' && (
                        <Button onClick={() => startSession(appointment)}>
                          <Video className="h-4 w-4 mr-2" />
                          Join
                        </Button>
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