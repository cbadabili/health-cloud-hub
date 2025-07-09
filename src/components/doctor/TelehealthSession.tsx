import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Phone, MessageSquare } from "lucide-react";

const TelehealthSession = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Telehealth Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Video Consultations</h3>
            <p className="text-muted-foreground mb-6">
              Secure video calling with integrated note-taking and prescriptions
            </p>
            <Button>Start Video Session</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelehealthSession;