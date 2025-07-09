import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye } from "lucide-react";

const MedicalRecords = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My Medical Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Your Medical History</h3>
            <p className="text-muted-foreground mb-6">
              View and download your complete medical records, lab results, and visit summaries
            </p>
            <Button>View Records</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicalRecords;