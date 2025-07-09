import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, Plus, Printer } from "lucide-react";

const PrescriptionManager = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Digital Prescriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Pill className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Prescription Management</h3>
            <p className="text-muted-foreground mb-6">
              Create, manage, and send digital prescriptions to patients
            </p>
            <Button>Create Prescription</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrescriptionManager;