import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Search, Plus } from "lucide-react";

const PatientRecords = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Patient Records (EHR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Electronic Health Records</h3>
            <p className="text-muted-foreground mb-6">
              Complete patient record management system will be available here
            </p>
            <Button>Access Patient Records</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientRecords;