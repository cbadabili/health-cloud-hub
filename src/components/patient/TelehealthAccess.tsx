import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Phone, Calendar } from "lucide-react";

const TelehealthAccess = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Telehealth Consultations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Virtual Doctor Visits</h3>
            <p className="text-muted-foreground mb-6">
              Join video consultations with your doctors from the comfort of your home
            </p>
            <Button>Join Telehealth Session</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelehealthAccess;