import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Video } from "lucide-react";

const AppointmentScheduler = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointment Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Appointment Scheduling System</h3>
            <p className="text-muted-foreground mb-6">
              Full appointment management functionality will be implemented here
            </p>
            <Button>Set Up Appointments</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentScheduler;