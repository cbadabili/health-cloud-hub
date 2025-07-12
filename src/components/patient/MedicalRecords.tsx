import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Eye, Pill, Activity, User, Calendar } from "lucide-react";

const MedicalRecords = () => {
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);

  const medicalRecords = [
    {
      id: "1",
      date: "2024-03-10",
      doctor: "Dr. Sarah Johnson",
      type: "Consultation",
      diagnosis: "Hypertension Follow-up",
      notes: "Blood pressure well controlled with current medication. Continue current treatment plan.",
      vitals: {
        bloodPressure: "120/80",
        heartRate: "72 bpm",
        temperature: "36.8°C",
        weight: "75 kg"
      }
    },
    {
      id: "2",
      date: "2024-02-15",
      doctor: "Dr. Michael Chen",
      type: "Lab Results",
      diagnosis: "Annual Health Check",
      notes: "All lab values within normal range. Cholesterol slightly elevated, recommend dietary changes.",
      labResults: [
        { test: "Cholesterol", value: "5.8 mmol/L", normal: "< 5.2 mmol/L", status: "high" },
        { test: "Blood Sugar", value: "4.9 mmol/L", normal: "3.9-6.1 mmol/L", status: "normal" },
        { test: "Hemoglobin", value: "14.2 g/dL", normal: "12-16 g/dL", status: "normal" }
      ]
    },
    {
      id: "3",
      date: "2024-01-20",
      doctor: "Dr. Emma Davis",
      type: "Prescription",
      diagnosis: "Acute Bronchitis",
      notes: "7-day course of antibiotics prescribed. Return if symptoms persist.",
      prescriptions: [
        { medication: "Amoxicillin", dosage: "500mg", frequency: "3 times daily", duration: "7 days" },
        { medication: "Cough Syrup", dosage: "10ml", frequency: "As needed", duration: "Until symptoms resolve" }
      ]
    }
  ];

  const currentPrescriptions = [
    { 
      medication: "Lisinopril", 
      dosage: "10mg", 
      frequency: "Once daily", 
      prescribedBy: "Dr. Sarah Johnson",
      startDate: "2023-08-15",
      status: "Active"
    },
    { 
      medication: "Metformin", 
      dosage: "500mg", 
      frequency: "Twice daily", 
      prescribedBy: "Dr. Michael Chen",
      startDate: "2023-10-01",
      status: "Active"
    }
  ];

  const allergies = ["Penicillin", "Shellfish"];
  const bloodType = "A+";

  return (
    <div className="space-y-6">
      <Tabs defaultValue="records" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="records">Visit Records</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="summary">Health Summary</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Medical Visit Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {medicalRecords.map((record) => (
                  <div key={record.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{record.diagnosis}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(record.date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {record.doctor}
                            </span>
                            <Badge variant="outline">{record.type}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedRecord(record.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                    
                    {selectedRecord === record.id && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <h5 className="font-medium mb-2">Notes:</h5>
                        <p className="text-sm mb-4">{record.notes}</p>
                        
                        {record.vitals && (
                          <div className="mb-4">
                            <h5 className="font-medium mb-2">Vital Signs:</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              <div>BP: {record.vitals.bloodPressure}</div>
                              <div>HR: {record.vitals.heartRate}</div>
                              <div>Temp: {record.vitals.temperature}</div>
                              <div>Weight: {record.vitals.weight}</div>
                            </div>
                          </div>
                        )}
                        
                        {record.labResults && (
                          <div className="mb-4">
                            <h5 className="font-medium mb-2">Lab Results:</h5>
                            <div className="space-y-2">
                              {record.labResults.map((lab, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                  <span>{lab.test}</span>
                                  <span>{lab.value}</span>
                                  <Badge variant={lab.status === 'normal' ? 'default' : 'destructive'}>
                                    {lab.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {record.prescriptions && (
                          <div>
                            <h5 className="font-medium mb-2">Prescriptions:</h5>
                            <div className="space-y-2">
                              {record.prescriptions.map((prescription, index) => (
                                <div key={index} className="text-sm">
                                  <strong>{prescription.medication}</strong> - {prescription.dosage}, {prescription.frequency} for {prescription.duration}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Current Prescriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentPrescriptions.map((prescription, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Pill className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{prescription.medication}</h4>
                        <p className="text-sm text-muted-foreground">
                          {prescription.dosage} - {prescription.frequency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Prescribed by {prescription.prescribedBy} on {new Date(prescription.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={prescription.status === 'Active' ? 'default' : 'secondary'}>
                      {prescription.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Health Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Blood Type</h4>
                  <Badge variant="outline" className="text-lg">{bloodType}</Badge>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Known Allergies</h4>
                  <div className="flex gap-2">
                    {allergies.map((allergy, index) => (
                      <Badge key={index} variant="destructive">{allergy}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Name:</strong> Jane Doe</p>
                  <p><strong>Relationship:</strong> Spouse</p>
                  <p><strong>Phone:</strong> +27 82 123 4567</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Medical Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "Insurance Card", type: "PDF", date: "2024-01-01" },
                  { name: "Medical Aid Certificate", type: "PDF", date: "2023-12-15" },
                  { name: "Vaccination Record", type: "PDF", date: "2023-08-20" },
                  { name: "MRI Scan Results", type: "PDF", date: "2023-06-10" }
                ].map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">{doc.type} • {doc.date}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicalRecords;