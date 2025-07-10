import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, Video, Search, Plus, Edit, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_type: string;
  status: string;
  reason_for_visit: string | null;
  notes: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

const AppointmentScheduler = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user?.id)
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
        title: "Error fetching appointments",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setAppointments(prev => 
        prev.map(apt => apt.id === id ? { ...apt, status } : apt)
      );

      toast({
        title: "Appointment updated",
        description: `Status changed to ${status}`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating appointment",
        description: error.message
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      case 'no_show': return <Badge className="bg-gray-100 text-gray-800">No Show</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filteredAppointments = appointments.filter(apt => 
    apt.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    apt.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    apt.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    apt.reason_for_visit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayAppointments = filteredAppointments.filter(apt => {
    const today = new Date().toDateString();
    const aptDate = new Date(apt.appointment_date).toDateString();
    return aptDate === today;
  });

  const upcomingAppointments = filteredAppointments.filter(apt => {
    const today = new Date();
    const aptDate = new Date(apt.appointment_date);
    return aptDate > today;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading appointments...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{todayAppointments.length}</div>
            <p className="text-sm text-muted-foreground">Today's Appointments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
            <p className="text-sm text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {appointments.filter(apt => apt.status === 'scheduled').length}
            </div>
            <p className="text-sm text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {appointments.filter(apt => apt.status === 'completed').length}
            </div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">Today's Schedule</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All Appointments</TabsTrigger>
        </TabsList>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Today's Schedule ({todayAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No appointments scheduled for today
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
                            {appointment.appointment_type} - {appointment.reason_for_visit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(appointment.status)}
                        {appointment.status === 'scheduled' && (
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
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
                <Clock className="h-5 w-5" />
                Upcoming Appointments ({upcomingAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming appointments
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
                            {appointment.appointment_type} - {appointment.reason_for_visit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(appointment.status)}
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
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
                <User className="h-5 w-5" />
                All Appointments ({filteredAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <div className="grid grid-cols-6 gap-4 p-4 bg-muted font-medium text-sm">
                  <div>Date & Time</div>
                  <div>Patient</div>
                  <div>Type</div>
                  <div>Reason</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                {filteredAppointments.map((appointment) => (
                  <div key={appointment.id} className="grid grid-cols-6 gap-4 p-4 border-t hover:bg-muted/50">
                    <div className="text-sm">
                      <div>{new Date(appointment.appointment_date).toLocaleDateString()}</div>
                      <div className="text-muted-foreground">
                        {new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {appointment.profiles?.first_name} {appointment.profiles?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {appointment.profiles?.email}
                      </div>
                    </div>
                    <div className="text-sm">{appointment.appointment_type}</div>
                    <div className="text-sm">{appointment.reason_for_visit || '-'}</div>
                    <div>{getStatusBadge(appointment.status)}</div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {appointment.appointment_type.toLowerCase().includes('telehealth') && (
                        <Button size="sm" variant="outline">
                          <Video className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {filteredAppointments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No appointments found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AppointmentScheduler;