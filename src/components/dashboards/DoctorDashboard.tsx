import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { 
  Calendar, 
  Users, 
  FileText, 
  Pill, 
  Video,
  DollarSign,
  Clock,
  Stethoscope
} from "lucide-react";
import { Link } from "react-router-dom";
import AppointmentScheduler from "@/components/doctor/AppointmentScheduler";
import PatientRecords from "@/components/doctor/PatientRecords";
import PrescriptionManager from "@/components/doctor/PrescriptionManager";
import TelehealthSession from "@/components/doctor/TelehealthSession";

const DoctorDashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const todayStats = [
    {
      title: "Today's Appointments",
      value: "12",
      subtitle: "3 upcoming",
      icon: Calendar,
      color: "text-blue-600"
    },
    {
      title: "Patients Seen",
      value: "8",
      subtitle: "This week: 42",
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Prescriptions",
      value: "15",
      subtitle: "5 pending",
      icon: Pill,
      color: "text-purple-600"
    },
    {
      title: "Revenue Today",
      value: "R4,250",
      subtitle: "This month: R128,500",
      icon: DollarSign,
      color: "text-orange-600"
    }
  ];

  const upcomingAppointments = [
    { time: "09:00", patient: "Sarah Johnson", type: "Consultation", status: "confirmed" },
    { time: "10:30", patient: "Michael Chen", type: "Follow-up", status: "confirmed" },
    { time: "14:00", patient: "Emma Davis", type: "Telehealth", status: "pending" },
    { time: "15:30", patient: "James Wilson", type: "Check-up", status: "confirmed" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-2 bg-gradient-primary rounded-lg hover:opacity-80 transition-opacity"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Stethoscope className="h-6 w-6 text-primary-foreground" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Doctor Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, Dr. {user?.email?.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("telehealth")}>
              <Video className="h-4 w-4 mr-2" />
              Start Telehealth
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="patients">Patient Records</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="telehealth">Telehealth</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {todayStats.map((stat, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today's Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Today's Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingAppointments.map((appointment, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {appointment.time}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{appointment.patient}</p>
                            <p className="text-sm text-muted-foreground">{appointment.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            appointment.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {appointment.status}
                          </span>
                          {appointment.type === 'Telehealth' && (
                            <Button size="sm" variant="outline" onClick={() => setActiveTab("telehealth")}>
                              <Video className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    variant="outline"
                    onClick={() => setActiveTab("appointments")}
                  >
                    View Full Schedule
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      className="h-20 flex flex-col gap-2" 
                      variant="outline"
                      onClick={() => setActiveTab("appointments")}
                    >
                      <Calendar className="h-6 w-6" />
                      New Appointment
                    </Button>
                    <Button 
                      className="h-20 flex flex-col gap-2" 
                      variant="outline"
                      onClick={() => setActiveTab("patients")}
                    >
                      <FileText className="h-6 w-6" />
                      Patient Notes
                    </Button>
                    <Button 
                      className="h-20 flex flex-col gap-2" 
                      variant="outline"
                      onClick={() => setActiveTab("prescriptions")}
                    >
                      <Pill className="h-6 w-6" />
                      Prescribe Medication
                    </Button>
                    <Button 
                      className="h-20 flex flex-col gap-2" 
                      variant="outline"
                      onClick={() => setActiveTab("telehealth")}
                    >
                      <Video className="h-6 w-6" />
                      Start Video Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Patients */}
            <Card>
              <CardHeader>
                <CardTitle>Recently Seen Patients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Sarah Johnson", lastVisit: "Today, 08:30", condition: "Hypertension follow-up" },
                    { name: "Michael Chen", lastVisit: "Yesterday", condition: "Annual check-up" },
                    { name: "Emma Davis", lastVisit: "2 days ago", condition: "Diabetes consultation" },
                    { name: "James Wilson", lastVisit: "3 days ago", condition: "Cold symptoms" }
                  ].map((patient, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-foreground">{patient.name}</p>
                        <p className="text-sm text-muted-foreground">{patient.condition}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{patient.lastVisit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentScheduler />
          </TabsContent>

          <TabsContent value="patients">
            <PatientRecords />
          </TabsContent>

          <TabsContent value="prescriptions">
            <PrescriptionManager />
          </TabsContent>

          <TabsContent value="telehealth">
            <TelehealthSession />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DoctorDashboard;