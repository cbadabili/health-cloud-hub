import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { 
  Calendar, 
  FileText, 
  Pill, 
  Video,
  DollarSign,
  Heart,
  Clock,
  User
} from "lucide-react";
import { Link } from "react-router-dom";
import AppointmentBooking from "@/components/patient/AppointmentBooking";
import MedicalRecords from "@/components/patient/MedicalRecords";
import PaymentHistory from "@/components/patient/PaymentHistory";
import TelehealthAccess from "@/components/patient/TelehealthAccess";

const PatientDashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const healthStats = [
    {
      title: "Next Appointment",
      value: "Mar 15",
      subtitle: "Dr. Smith - 2:30 PM",
      icon: Calendar,
      color: "text-blue-600"
    },
    {
      title: "Active Prescriptions",
      value: "3",
      subtitle: "2 refills needed",
      icon: Pill,
      color: "text-green-600"
    },
    {
      title: "Upcoming Payments",
      value: "R450",
      subtitle: "Due Mar 20",
      icon: DollarSign,
      color: "text-orange-600"
    },
    {
      title: "Health Score",
      value: "Good",
      subtitle: "Last updated today",
      icon: Heart,
      color: "text-red-600"
    }
  ];

  const recentActivity = [
    { type: "appointment", description: "Consultation with Dr. Smith", date: "2 days ago" },
    { type: "prescription", description: "Blood pressure medication refilled", date: "5 days ago" },
    { type: "payment", description: "Payment of R350 processed", date: "1 week ago" },
    { type: "lab", description: "Blood test results available", date: "2 weeks ago" }
  ];

  const upcomingAppointments = [
    { date: "Mar 15", time: "2:30 PM", doctor: "Dr. Smith", type: "Follow-up" },
    { date: "Mar 22", time: "10:00 AM", doctor: "Dr. Johnson", type: "Telehealth" },
    { date: "Apr 5", time: "9:15 AM", doctor: "Dr. Chen", type: "Check-up" }
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
              <User className="h-6 w-6 text-primary-foreground" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Patient Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.email?.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("telehealth")}>
              <Video className="h-4 w-4 mr-2" />
              Join Telehealth
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
            <TabsTrigger value="records">Medical Records</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="telehealth">Telehealth</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Health Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {healthStats.map((stat, index) => (
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
              {/* Upcoming Appointments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Upcoming Appointments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingAppointments.map((appointment, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{appointment.doctor}</p>
                          <p className="text-sm text-muted-foreground">{appointment.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{appointment.date}</p>
                          <p className="text-sm text-muted-foreground">{appointment.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    variant="outline"
                    onClick={() => setActiveTab("appointments")}
                  >
                    Book New Appointment
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
                      Book Appointment
                    </Button>
                    <Button 
                      className="h-20 flex flex-col gap-2" 
                      variant="outline"
                      onClick={() => setActiveTab("records")}
                    >
                      <FileText className="h-6 w-6" />
                      View Records
                    </Button>
                    <Button 
                      className="h-20 flex flex-col gap-2" 
                      variant="outline"
                      onClick={() => setActiveTab("records")}
                    >
                      <Pill className="h-6 w-6" />
                      Prescriptions
                    </Button>
                    <Button 
                      className="h-20 flex flex-col gap-2" 
                      variant="outline"
                      onClick={() => setActiveTab("payments")}
                    >
                      <DollarSign className="h-6 w-6" />
                      Pay Bills
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-4 p-3 border border-border rounded-lg">
                      <div className={`p-2 rounded-full ${
                        activity.type === 'appointment' ? 'bg-blue-100 text-blue-600' :
                        activity.type === 'prescription' ? 'bg-green-100 text-green-600' :
                        activity.type === 'payment' ? 'bg-orange-100 text-orange-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {activity.type === 'appointment' && <Calendar className="h-4 w-4" />}
                        {activity.type === 'prescription' && <Pill className="h-4 w-4" />}
                        {activity.type === 'payment' && <DollarSign className="h-4 w-4" />}
                        {activity.type === 'lab' && <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{activity.description}</p>
                        <p className="text-sm text-muted-foreground">{activity.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentBooking />
          </TabsContent>

          <TabsContent value="records">
            <MedicalRecords />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentHistory />
          </TabsContent>

          <TabsContent value="telehealth">
            <TelehealthAccess />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PatientDashboard;