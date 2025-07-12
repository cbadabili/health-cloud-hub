import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Phone, Calendar, Clock, User, Monitor, Mic, Camera, Settings } from "lucide-react";
import { toast } from "sonner";

const TelehealthAccess = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const upcomingTelehealthAppointments = [
    {
      id: "1",
      doctor: "Dr. Michael Chen",
      specialty: "General Practice",
      date: "2024-03-15",
      time: "14:30",
      duration: "30 minutes",
      status: "Confirmed",
      meetingId: "TCH-001-2024"
    },
    {
      id: "2",
      doctor: "Dr. Emma Davis",
      specialty: "Pediatrics",
      date: "2024-03-20",
      time: "10:00",
      duration: "20 minutes",
      status: "Pending",
      meetingId: "TCH-002-2024"
    }
  ];

  const pastSessions = [
    {
      id: "1",
      doctor: "Dr. Sarah Johnson",
      date: "2024-03-05",
      duration: "25 minutes",
      notes: "Follow-up on blood pressure medication. All normal."
    },
    {
      id: "2",
      doctor: "Dr. Michael Chen",
      date: "2024-02-20",
      duration: "30 minutes",
      notes: "Annual check-up completed via telehealth."
    }
  ];

  const handleJoinCall = (meetingId: string) => {
    setIsCallActive(true);
    toast.success(`Joining telehealth session ${meetingId}...`);
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    toast.success("Telehealth session ended.");
  };

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
    toast.success(isMicOn ? "Microphone muted" : "Microphone unmuted");
  };

  const toggleCamera = () => {
    setIsCameraOn(!isCameraOn);
    toast.success(isCameraOn ? "Camera turned off" : "Camera turned on");
  };

  if (isCallActive) {
    return (
      <div className="space-y-6">
        <Card className="bg-slate-900 text-white">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Telehealth Session Active</h2>
              <p className="text-slate-300">Dr. Michael Chen - General Practice</p>
              <Badge className="mt-2">Connected</Badge>
            </div>
            
            {/* Video Area */}
            <div className="bg-slate-800 rounded-lg p-8 mb-6 text-center">
              <Monitor className="h-24 w-24 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-300">Video call in progress...</p>
            </div>

            {/* Call Controls */}
            <div className="flex justify-center gap-4">
              <Button
                onClick={toggleMic}
                variant={isMicOn ? "secondary" : "destructive"}
                size="lg"
                className="rounded-full p-4"
              >
                <Mic className="h-6 w-6" />
              </Button>
              <Button
                onClick={toggleCamera}
                variant={isCameraOn ? "secondary" : "destructive"}
                size="lg"
                className="rounded-full p-4"
              >
                <Camera className="h-6 w-6" />
              </Button>
              <Button
                onClick={handleEndCall}
                variant="destructive"
                size="lg"
                className="rounded-full p-4"
              >
                <Phone className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full p-4"
              >
                <Settings className="h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span>Camera</span>
              </div>
              <Badge variant="default">Ready</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span>Microphone</span>
              </div>
              <Badge variant="default">Ready</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span>Connection</span>
              </div>
              <Badge variant="default">Good</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Upcoming Telehealth Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingTelehealthAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Video className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{appointment.doctor}</h4>
                    <p className="text-sm text-muted-foreground">{appointment.specialty}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(appointment.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {appointment.time} ({appointment.duration})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Meeting ID: {appointment.meetingId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={appointment.status === 'Confirmed' ? 'default' : 'secondary'}>
                    {appointment.status}
                  </Badge>
                  <Button
                    onClick={() => handleJoinCall(appointment.meetingId)}
                    disabled={appointment.status !== 'Confirmed'}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Join Session
                  </Button>
                </div>
              </div>
            ))}
            {upcomingTelehealthAppointments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming telehealth sessions scheduled.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Join */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Quick Join
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Meeting ID</label>
              <input
                type="text"
                placeholder="Enter meeting ID (e.g., TCH-001-2024)"
                className="w-full px-3 py-2 border border-border rounded-md"
              />
            </div>
            <Button>
              <Video className="h-4 w-4 mr-2" />
              Join
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pastSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{session.doctor}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(session.date).toLocaleDateString()} • {session.duration}
                    </p>
                    <p className="text-xs text-muted-foreground">{session.notes}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View Summary
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-16">
              <div className="text-center">
                <Settings className="h-5 w-5 mx-auto mb-1" />
                <p className="text-sm">Technical Support</p>
              </div>
            </Button>
            <Button variant="outline" className="h-16">
              <div className="text-center">
                <Phone className="h-5 w-5 mx-auto mb-1" />
                <p className="text-sm">Contact Clinic</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelehealthAccess;