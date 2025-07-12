import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, User, Stethoscope } from "lucide-react";
import { toast } from "sonner";

const AppointmentBooking = () => {
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");

  const doctors = [
    { id: "1", name: "Dr. Sarah Johnson", specialty: "Cardiology", fee: "R650" },
    { id: "2", name: "Dr. Michael Chen", specialty: "General Practice", fee: "R450" },
    { id: "3", name: "Dr. Emma Davis", specialty: "Pediatrics", fee: "R550" },
    { id: "4", name: "Dr. James Wilson", specialty: "Dermatology", fee: "R500" },
  ];

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
  ];

  const upcomingAppointments = [
    { 
      id: "1", 
      doctor: "Dr. Sarah Johnson", 
      specialty: "Cardiology",
      date: "2024-03-15", 
      time: "14:30", 
      status: "Confirmed",
      location: "Room 302"
    },
    { 
      id: "2", 
      doctor: "Dr. Michael Chen", 
      specialty: "General Practice",
      date: "2024-03-22", 
      time: "10:00", 
      status: "Pending",
      location: "Telehealth"
    },
  ];

  const handleBookAppointment = () => {
    if (!selectedDoctor || !selectedDate || !selectedTime || !reason) {
      toast.error("Please fill in all required fields");
      return;
    }

    toast.success("Appointment request sent! You'll receive confirmation shortly.");
    
    // Reset form
    setSelectedDoctor("");
    setSelectedDate("");
    setSelectedTime("");
    setReason("");
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doctor">Select Doctor</Label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{doctor.name}</p>
                          <p className="text-sm text-muted-foreground">{doctor.specialty} - {doctor.fee}</p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Preferred Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Preferred Time</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose time slot" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {time}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Visit</Label>
              <Textarea
                id="reason"
                placeholder="Brief description of your symptoms or reason for visit"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="md:col-span-1"
              />
            </div>
          </div>

          <Button onClick={handleBookAppointment} className="w-full md:w-auto">
            Book Appointment
          </Button>
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
          <div className="space-y-4">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{appointment.doctor}</h4>
                    <p className="text-sm text-muted-foreground">{appointment.specialty}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {new Date(appointment.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {appointment.time}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {appointment.location}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    appointment.status === 'Confirmed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {appointment.status}
                  </span>
                  <Button variant="outline" size="sm">
                    {appointment.location === 'Telehealth' ? 'Join Call' : 'View Details'}
                  </Button>
                </div>
              </div>
            ))}
            {upcomingAppointments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming appointments. Book your first appointment above!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentBooking;